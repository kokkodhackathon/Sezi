-- Vakıf Eserleri Envanter Projesi uyumu (KÖK&KOD bilgi notu, Ekim 2026).
-- Beklenen veri alanları: il, eser adı, eser türü, konum, tarihçe, TR/EN metinler, fotoğraf galerileri, sergi bilgileri.
-- Çalışma şehirleri: Hatay, Konya, Bursa; yapı yeni illerin eklenmesine açık.

-- ---------- Şehirler: envanter bilgisi ----------
create type public.inventory_status as enum ('published', 'printing', 'in_progress', 'planned');

alter table public.cities
  add column slug text unique,
  add column is_active boolean not null default false,
  add column sort_order int not null default 100,
  add column inventory_year int,
  add column inventory_works int,
  add column inventory_photos int,
  add column inventory_status public.inventory_status,
  add column inventory_note jsonb check (public.is_localized(inventory_note));

update public.cities set slug = 'istanbul', is_active = false where name ->> 'tr' = 'İstanbul';

insert into public.cities (region_id, name, slug, center, is_active, sort_order, inventory_year, inventory_works, inventory_photos, inventory_status, inventory_note)
select r.id, v.name::jsonb, v.slug, extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
       v.active, v.ord, v.y, v.works, v.photos, v.status::public.inventory_status, v.note::jsonb
from (values
  ('Akdeniz',    '{"tr":"Hatay","en":"Hatay"}',     'hatay',   36.1600, 36.2000, true,  1, 2022, 117, 2600,  'published',   '{"tr":"6 Şubat 2023 depremlerinden kısa süre önce belgelendi; fotoğrafların bir bölümü bugün yalnızca hafıza olarak kalan yapıları gösterir.","en":"Documented shortly before the 6 February 2023 earthquakes; some photographs now preserve buildings that survive only as memory."}'),
  ('İç Anadolu', '{"tr":"Konya","en":"Konya"}',     'konya',   32.4930, 37.8710, true,  2, 2024, 289, 15200, 'published',   null),
  ('Marmara',    '{"tr":"Bursa","en":"Bursa"}',     'bursa',   29.0610, 40.1830, true,  3, 2025, 385, 34952, 'printing',    '{"tr":"Fethin 700. yılında hazırlandı; kitapların baskı süreci sürüyor.","en":"Prepared for the 700th anniversary of the conquest; the books are being printed."}'),
  ('Ege',        '{"tr":"Kütahya","en":"Kütahya"}', 'kutahya', 29.9833, 39.4167, false, 4, 2025, 141, 11871, 'printing',    null),
  ('Ege',        '{"tr":"İzmir","en":"İzmir"}',     'izmir',   27.1428, 38.4237, false, 5, 2026, null, null, 'in_progress', null),
  ('Ege',        '{"tr":"Manisa","en":"Manisa"}',   'manisa',  27.4289, 38.6191, false, 6, 2026, null, null, 'in_progress', null)
) as v(region, name, slug, lng, lat, active, ord, y, works, photos, status, note)
join public.regions r on r.name ->> 'tr' = v.region;

-- ---------- Eser türleri: envanterde yer alan tüm yapı türleri ----------
insert into public.work_types (slug, name) values
  ('kilise',  '{"tr":"Kilise","en":"Church"}'),
  ('sinagog', '{"tr":"Sinagog","en":"Synagogue"}'),
  ('tekke',   '{"tr":"Tekke ve zaviye","en":"Sufi lodge"}'),
  ('mektep',  '{"tr":"Mektep","en":"School"}'),
  ('carsi',   '{"tr":"Çarşı ve bedesten","en":"Bazaar"}'),
  ('konak',   '{"tr":"Konak ve ev","en":"Mansion and house"}'),
  ('degirmen','{"tr":"Değirmen","en":"Mill"}'),
  ('sarnic',  '{"tr":"Sarnıç","en":"Cistern"}'),
  ('hazire',  '{"tr":"Hazire ve mezarlık","en":"Graveyard"}'),
  ('kulliye', '{"tr":"Külliye","en":"Complex"}'),
  ('diger',   '{"tr":"Diğer","en":"Other"}')
on conflict (slug) do nothing;

-- ---------- Eserler: envanter alanları ----------
create type public.work_condition as enum ('intact', 'restored', 'damaged', 'destroyed', 'unknown');
create type public.location_precision as enum ('exact', 'approximate', 'unknown');

alter table public.works
  alter column location drop not null,
  add column district text,
  add column address jsonb check (public.is_localized(address)),
  add column period jsonb check (public.is_localized(period)),           -- ör. "XIX. yüzyıl başı"
  add column architecture jsonb check (public.is_localized(architecture)),-- mimari ve teknik detaylar
  add column condition public.work_condition not null default 'unknown',
  add column condition_note jsonb check (public.is_localized(condition_note)),
  add column unesco boolean not null default false,
  add column location_precision public.location_precision not null default 'exact',
  add column external_ids jsonb not null default '{}'::jsonb,            -- {"wikidata":"Q…","osm":"way/…"}
  add column needs_review boolean not null default false;

create index works_district_idx on public.works (city_id, district);

-- Süleymaniye pilotu envanter kapsamı dışında kaldı: veri silinmez, arşivlenir.
update public.works set status = 'archived' where city_id = (select id from public.cities where slug = 'istanbul');
update public.complexes set status = 'archived' where city_id = (select id from public.cities where slug = 'istanbul');

-- Kaynak: envanter kitabı cilt/sayfa ve bölüm bilgisi work_sources.page içinde tutulur.
alter table public.sources add column kind text not null default 'other' check (kind in ('inventory', 'wikidata', 'osm', 'academic', 'web', 'other'));
alter table public.sources add column city_id uuid references public.cities(id);
alter table public.sources add column volume int;
create index sources_city_idx on public.sources (city_id);
alter table public.work_sources add column section jsonb check (public.is_localized(section));

-- ---------- Tarihçe olayları (zaman çizelgesi) ----------
create type public.event_kind as enum ('built', 'repaired', 'restored', 'damaged', 'destroyed', 'converted', 'documented', 'other');

create table public.work_events (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  kind public.event_kind not null,
  year int check (year between 0 and 2100),
  year_text jsonb check (public.is_localized(year_text)),                 -- "XIV. yüzyıl", "1474 (Memlük)"
  description jsonb not null check (public.is_localized(description)),
  source_id uuid references public.sources(id),
  page text,
  status public.content_status not null default 'draft',
  sort_order int not null default 0
);
create index work_events_work_idx on public.work_events (work_id);
create index work_events_source_idx on public.work_events (source_id);

-- ---------- Kitabeler ----------
create table public.inscriptions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  placement jsonb check (public.is_localized(placement)),                 -- "taç kapı üzeri"
  original text,                                                          -- transkripsiyon
  meaning jsonb check (public.is_localized(meaning)),                     -- "Mealen: …"
  date_text text,
  source_id uuid references public.sources(id),
  page text,
  status public.content_status not null default 'draft'
);
create index inscriptions_work_idx on public.inscriptions (work_id);
create index inscriptions_source_idx on public.inscriptions (source_id);

-- ---------- Sergiler ----------
create table public.exhibitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  city_id uuid references public.cities(id),                              -- envanterin ili
  title jsonb not null check (public.is_localized(title)),
  venue jsonb not null check (public.is_localized(venue)),
  starts_on date,
  ends_on date,
  photo_count int,
  description jsonb check (public.is_localized(description)),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  status public.content_status not null default 'draft'
);
create index exhibitions_city_idx on public.exhibitions (city_id);

create table public.work_exhibitions (
  work_id uuid references public.works(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete cascade,
  primary key (work_id, exhibition_id)
);
create index work_exhibitions_exhibition_idx on public.work_exhibitions (exhibition_id);

insert into public.exhibitions (slug, city_id, title, venue, starts_on, ends_on, photo_count, description, source_url, status)
select v.slug, c.id, v.title::jsonb, v.venue::jsonb, v.s::date, v.e::date, v.n, v.d::jsonb, v.url, 'verified'
from (values
  ('5-subat-hatay', 'hatay', '{"tr":"5 Şubat Hatay","en":"5 February Hatay"}',
   '{"tr":"Vakıf Katılım Mimar Sinan Galerisi, Üsküdar, İstanbul","en":"Vakıf Katılım Mimar Sinan Gallery, Üsküdar, Istanbul"}',
   '2023-10-05', '2023-11-26', 59,
   '{"tr":"Hatay Vakıf Eserleri Envanter Projesi kapsamında depremden hemen önce çekilen fotoğraflardan seçilen 59 kare.","en":"59 photographs selected from those taken just before the earthquake for the Hatay inventory project."}',
   'https://www.vakifkatilim.com.tr/tr/hakkimizda/medya-merkezi/duyurular/duyuru-detay/vakif-katilim-hatayin-depremden-bir-gun-oncesini-fotograflarla-yasatiyor'),
  ('ayna', 'konya', '{"tr":"Ayna","en":"Ayna (Mirror)"}',
   '{"tr":"Mimar Sinan Galerisi, Üsküdar, İstanbul","en":"Mimar Sinan Gallery, Üsküdar, Istanbul"}',
   '2025-01-24', null, null,
   '{"tr":"Konya Vakıf Eserleri kitabı için çekilen fotoğraflardan oluşan sergi.","en":"An exhibition of photographs taken for the Konya inventory book."}',
   null),
  ('bursa-vakif-eserleri', 'bursa', '{"tr":"Bursa Vakıf Eserleri Açık Hava Sergisi","en":"Bursa Foundation Works Open-Air Exhibition"}',
   '{"tr":"Tophane Meydanı; yıl boyunca Orhangazi Meydanı, Cumhuriyet Caddesi, Çarşıbaşı Meydanı, Emir Sultan Meydanı ve UNESCO Meydanı","en":"Tophane Square; throughout the year at Orhangazi Square, Cumhuriyet Street, Çarşıbaşı Square, Emir Sultan Square and UNESCO Square"}',
   '2026-04-04', null, 276,
   '{"tr":"Bursa’nın fethinin 700. yılı etkinlikleri kapsamında, Bursa Vakıf Eserleri envanterinden seçilen 276 fotoğraf.","en":"276 photographs from the Bursa inventory, part of the events for the 700th anniversary of the conquest of Bursa."}',
   'https://www.vakifkatilim.com.tr/tr/hakkimizda/medya-merkezi/duyurular/duyuru-detay/vakif-katilimdan-bursanin-fethinin-700-yilina-ozel-fotograf-sergisi')
) as v(slug, city, title, venue, s, e, n, d, url)
join public.cities c on c.slug = v.city;

-- ---------- Terimler sözlüğü ----------
create table public.glossary_terms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  term jsonb not null check (public.is_localized(term)),
  definition jsonb not null check (public.is_localized(definition)),
  source_id uuid references public.sources(id),
  status public.content_status not null default 'draft'
);
create index glossary_terms_source_idx on public.glossary_terms (source_id);

-- ---------- RLS ----------
alter table public.work_events enable row level security;
alter table public.inscriptions enable row level security;
alter table public.exhibitions enable row level security;
alter table public.work_exhibitions enable row level security;
alter table public.glossary_terms enable row level security;

create policy read_verified on public.work_events    for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.inscriptions   for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.exhibitions    for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.glossary_terms for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_all on public.work_exhibitions for select to anon, authenticated using (true);

do $$
declare t text;
begin
  foreach t in array array['work_events','inscriptions','exhibitions','work_exhibitions','glossary_terms']
  loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- ---------- İstemci görünümü ----------
drop view public.works_view;
create view public.works_view with (security_invoker = true) as
select
  w.id, w.slug, w.name, w.summary, w.history, w.architecture, w.period, w.built_year, w.founder, w.a11y_score, w.status,
  w.district, w.address, w.condition, w.condition_note, w.unesco, w.location_precision,
  t.slug as type_slug, t.name as type_name,
  ci.slug as city_slug, ci.name as city_name,
  c.slug as complex_slug, c.name as complex_name,
  extensions.st_x(w.location::extensions.geometry) as lng,
  extensions.st_y(w.location::extensions.geometry) as lat,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'publisher', s.publisher, 'year', s.year,
                                        'url', s.url, 'page', ws.page, 'kind', s.kind, 'volume', s.volume, 'section', ws.section)
                     order by (s.kind = 'inventory') desc, s.title)
    from public.work_sources ws join public.sources s on s.id = ws.source_id
    where ws.work_id = w.id
  ), '[]'::jsonb) as sources,
  coalesce((
    select jsonb_agg(jsonb_build_object('slug', e.slug, 'title', e.title, 'venue', e.venue, 'starts_on', e.starts_on, 'ends_on', e.ends_on))
    from public.work_exhibitions we join public.exhibitions e on e.id = we.exhibition_id
    where we.work_id = w.id and e.status = 'verified'
  ), '[]'::jsonb) as exhibitions
from public.works w
join public.work_types t on t.id = w.work_type_id
join public.cities ci on ci.id = w.city_id
left join public.complexes c on c.id = w.complex_id;

grant select on public.works_view to anon, authenticated;
