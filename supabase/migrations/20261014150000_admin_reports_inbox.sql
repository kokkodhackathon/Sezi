-- Admin paneli ile uygulama arasındaki bağlantılar (14 Ekim 2026).

-- 1) Erişilebilirlik bildirimleri pilot grafiğine bağlanır.
--    Grafik uygulamaya gömülü (OSM segment kimlikleri, ör. "w123_4"); bildirim bu anahtarı taşır.
--    Bildirim için hesap gerekmez: denetimli RPC ile gelir, moderasyondan geçmeden etkisizdir.
alter table public.a11y_reports
  alter column segment_id drop not null,
  alter column user_id drop not null,
  add column area text check (length(area) <= 64),
  add column segment_key text check (length(segment_key) <= 64),
  add column work_slug text check (length(work_slug) <= 128),
  add column device_id text check (length(device_id) <= 64),
  add constraint a11y_reports_target check (segment_id is not null or segment_key is not null);

create index a11y_reports_area_key_idx on public.a11y_reports (area, segment_key) where status = 'approved';
create index a11y_reports_device_idx on public.a11y_reports (device_id, created_at);

create or replace function public.submit_a11y_report(
  p_area text,
  p_segment_key text,
  p_type public.report_type,
  p_note text default null,
  p_work_slug text default null,
  p_device_id text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid;
begin
  if p_area is null or p_segment_key is null or length(p_area) > 64 or length(p_segment_key) > 64 then
    raise exception 'Geçersiz bölge ya da yol parçası';
  end if;
  if p_note is not null and length(p_note) > 500 then
    raise exception 'Not en fazla 500 karakter olabilir';
  end if;
  -- Basit kötüye kullanım sınırı: aynı cihazdan saatte en fazla 10 bildirim.
  if p_device_id is not null and (
    select count(*) from public.a11y_reports r where r.device_id = p_device_id and r.created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Çok fazla bildirim gönderildi; biraz sonra tekrar deneyin';
  end if;
  insert into public.a11y_reports (area, segment_key, type, note, work_slug, device_id, user_id, status)
  values (p_area, p_segment_key, p_type, nullif(btrim(p_note), ''), left(p_work_slug, 128), left(p_device_id, 64), auth.uid(), 'pending')
  returning id into rid;
  return rid;
end $$;

revoke all on function public.submit_a11y_report(text, text, public.report_type, text, text, text) from public;
grant execute on function public.submit_a11y_report(text, text, public.report_type, text, text, text) to anon, authenticated;

-- Onaylı bildirimlerin etkisi (uygulama rotada uygular): yalnızca anahtar ve tür, kişisel veri yok.
create or replace function public.report_overrides(p_area text)
returns table (segment_key text, type public.report_type)
language sql stable security definer set search_path = '' as $$
  select distinct r.segment_key, r.type
  from public.a11y_reports r
  where r.area = p_area and r.status = 'approved' and r.segment_key is not null
$$;

revoke all on function public.report_overrides(text) from public;
grant execute on function public.report_overrides(text) to anon, authenticated;

-- Gönderenin kendi bildirimlerinin durumu (cihazdaki kimliklerle; başkasının bildirimini listelemez).
create or replace function public.report_statuses(p_ids uuid[])
returns table (id uuid, status public.report_status)
language sql stable security definer set search_path = '' as $$
  select r.id, r.status from public.a11y_reports r where r.id = any(p_ids[1:100])
$$;

revoke all on function public.report_statuses(uuid[]) from public;
grant execute on function public.report_statuses(uuid[]) to anon, authenticated;

-- 2) Fotoğraf kutusu: kitapta eşleşmeyen arşiv fotoğrafları esere bağlanmadan bekler (taslak, uygulamada görünmez).
alter table public.media
  alter column work_id drop not null,
  add column folder text;

alter table public.media add constraint media_unassigned_is_draft check (work_id is not null or status = 'draft');
