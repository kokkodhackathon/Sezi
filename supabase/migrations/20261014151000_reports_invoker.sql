-- Bildirim akışı SECURITY DEFINER RPC'ler yerine RLS + tetikleyici ile (güvenlik denetimi: 0 uyarı).

drop function if exists public.submit_a11y_report(text, text, public.report_type, text, text, text);
drop function if exists public.report_overrides(text);
drop function if exists public.report_statuses(uuid[]);

-- Hesapsız bildirim: yalnızca "pending" ve pilot grafiği anahtarıyla eklenebilir; okuma yine yalnızca admin/sahibi.
create policy insert_anonymous on public.a11y_reports for insert to anon, authenticated
  with check (
    status = 'pending' and reviewed_by is null and reviewed_at is null
    and segment_key is not null and area is not null
    and user_id is not distinct from (select auth.uid())
  );

-- Ekleme öncesi temizlik ve kötüye kullanım sınırı (tetikleyici fonksiyonu RPC olarak çağrılamaz).
create or replace function public.a11y_report_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.note := nullif(btrim(new.note), '');
  if new.device_id is not null and (
    select count(*) from public.a11y_reports r where r.device_id = new.device_id and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Çok fazla bildirim gönderildi; biraz sonra tekrar deneyin';
  end if;
  return new;
end $$;

revoke all on function public.a11y_report_guard() from public, anon, authenticated;

create trigger a11y_reports_guard before insert on public.a11y_reports
  for each row execute function public.a11y_report_guard();

-- Onaylanan bildirimin rotaya etkisi: uygulamanın okuduğu sade tablo (kişisel veri yok).
create table public.segment_overrides (
  area text not null,
  segment_key text not null,
  type public.report_type not null,
  report_id uuid not null references public.a11y_reports(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (area, segment_key, type)
);
create index segment_overrides_report_idx on public.segment_overrides (report_id);

alter table public.segment_overrides enable row level security;
create policy read_all on public.segment_overrides for select to anon, authenticated using (true);
create policy admin_write on public.segment_overrides for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Onay/geri alma etkiyi ekler ya da kaldırır (admin'in yetkisiyle çalışır).
create or replace function public.sync_segment_override() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.segment_key is null or new.area is null then
    return new;
  end if;
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.segment_overrides (area, segment_key, type, report_id)
    values (new.area, new.segment_key, new.type, new.id)
    on conflict (area, segment_key, type) do nothing;
  elsif new.status <> 'approved' and old.status = 'approved' then
    delete from public.segment_overrides where report_id = new.id;
  end if;
  return new;
end $$;

create trigger a11y_reports_sync_override after update on public.a11y_reports
  for each row execute function public.sync_segment_override();
