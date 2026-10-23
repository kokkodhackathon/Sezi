-- Turlar: admin panelinden girilen hazır turlar (kodda sabit tur yok).
-- stops eser slug'larıdır. fixed_order = false iken uygulama sırayı başlangıç noktasından en yakın komşu ile
-- hesaplar (stops yalnız durak kümesidir); true iken kayıtlı sıra korunur. Profile ulaşılamayan durak atlanır.
create table public.tours (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city_id uuid not null references public.cities(id),
  title jsonb not null check (public.is_localized(title)),
  body jsonb check (public.is_localized(body)),
  stops text[] not null check (cardinality(stops) between 2 and 12),
  fixed_order boolean not null default false,
  sort_order int not null default 0,
  status public.content_status not null default 'draft',
  updated_at timestamptz not null default now()
);
create index tours_city_idx on public.tours (city_id);

create trigger tours_updated before update on public.tours for each row execute function public.set_updated_at();

-- Duraklar o ilin eserleri olmalı ve tekrar etmemeli (dizi elemanına yabancı anahtar verilemiyor).
create function public.tours_check_stops() returns trigger
language plpgsql set search_path = '' as $$
declare
  missing text;
begin
  if cardinality(new.stops) <> (select count(distinct s) from unnest(new.stops) as s) then
    raise exception 'Aynı eser turda iki kez olamaz';
  end if;
  select s into missing from unnest(new.stops) as s
  where not exists (select 1 from public.works w where w.slug = s and w.city_id = new.city_id)
  limit 1;
  if missing is not null then
    raise exception 'Durak bu ilin eseri değil: %', missing;
  end if;
  return new;
end $$;

create trigger tours_check_stops before insert or update on public.tours
  for each row execute function public.tours_check_stops();

-- Okuma: herkes yalnızca yayındaki turları görür (admin hepsini). Yazma: admin.
alter table public.tours enable row level security;
create policy read_verified on public.tours for select to anon, authenticated
  using (status = 'verified' or (select public.is_admin()));
create policy admin_insert on public.tours for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.tours for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.tours for delete to authenticated using ((select public.is_admin()));

-- İstemci görünümü: il slug'ı tek satırda. security_invoker: RLS çağıranın yetkisiyle uygulanır.
create view public.tours_view with (security_invoker = true) as
select t.id, t.slug, t.city_id, c.slug as city_slug, t.title, t.body, t.stops, t.fixed_order, t.sort_order, t.status, t.updated_at
from public.tours t
join public.cities c on c.id = t.city_id;

grant select on public.tours_view to anon, authenticated;
