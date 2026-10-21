-- Wikimedia Commons fotoğrafları: envanter fotoğrafı olmayan eserler için Wikidata'nın temsil görseli (P18).
-- Dosya bizim `media` kovasına kopyalanır (uygulama internetsiz çalışır); atıf için gereken her bilgi satırda tutulur.
-- Pipeline: data/commons_photos.py. Satırlar `draft` girer; admin onaylamadan anonim kullanıcı görmez (RLS).

alter table public.media
  add column origin text not null default 'inventory' check (origin in ('inventory', 'commons')),
  -- Fotoğrafçı (Commons `Artist`, HTML'siz)
  add column author text,
  -- Lisans kısa adı ("CC BY-SA 4.0", "CC0", "Public domain") ve bağlantısı
  add column license text,
  add column license_url text,
  -- Commons dosya sayfası
  add column source_url text,
  -- Dosyada yaptığımız değişiklik {tr, en} (ör. küçültme, biçim dönüşümü)
  add column modifications jsonb,
  -- Fotoğrafın geldiği Wikidata öğesi: eserin eşleşmesi bu öğeyle kabul edilmeden yayınlanamaz
  add column wikidata_id text check (wikidata_id ~ '^Q\d+$');

alter table public.media add constraint media_commons_attribution check (
  origin <> 'commons' or (license is not null and source_url is not null and wikidata_id is not null)
);

-- Commons fotoğrafı ancak eserin Wikidata eşleşmesi eşleştirme masasında kabul edildiyse yayınlanır.
-- (`works.external_ids` otomatik eşleştirmeyle de dolar; onayın tek kanıtı `location_candidates.status`.)
create function public.media_commons_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin = 'commons' and new.status = 'verified' and not exists (
    select 1 from public.location_candidates lc
    where lc.work_id = new.work_id and lc.source = 'wikidata' and lc.ref = new.wikidata_id and lc.status = 'accepted'
  ) then
    raise exception 'Commons fotoğrafı yayınlanamaz: eserin Wikidata eşleşmesi (%) eşleştirme masasında kabul edilmemiş.', new.wikidata_id
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger media_commons_guard
  before insert or update of status, work_id, wikidata_id, origin on public.media
  for each row execute function public.media_commons_guard();

-- Eşleşme kabulü geri alınırsa o öğeden gelen yayındaki Commons fotoğrafları taslağa döner.
create function public.media_commons_unpublish() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.media m set status = 'draft'
  where m.origin = 'commons' and m.status = 'verified' and m.work_id = old.work_id and m.wikidata_id = old.ref;
  return new;
end;
$$;

create trigger location_candidates_commons_unpublish
  after update of status on public.location_candidates
  for each row
  when (old.source = 'wikidata' and old.status = 'accepted' and new.status is distinct from 'accepted')
  execute function public.media_commons_unpublish();

-- works_view.photos: atıf alanları eklenir (yalnız doğrulanmış medya; anonim RLS zaten süzer).
create or replace view public.works_view with (security_invoker = true) as
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
  ), '[]'::jsonb) as exhibitions,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'thumb', m.thumb_path, 'alt', m.alt_text,
                                        'credit', m.credit, 'kind', m.kind, 'width', m.width, 'height', m.height,
                                        'origin', m.origin, 'author', m.author, 'license', m.license,
                                        'license_url', m.license_url, 'source_url', m.source_url,
                                        'modifications', m.modifications)
                     -- Envanter fotoğrafı her zaman önce: kapak bize verilen arşivden gelir, Commons ek olur.
                     order by (m.origin = 'commons'), m.sort_order, m.id)
    from public.media m
    where m.work_id = w.id and m.status = 'verified'
  ), '[]'::jsonb) as photos,
  atr.storage_path as audio_tr,
  aen.storage_path as audio_en
from public.works w
join public.work_types t on t.id = w.work_type_id
join public.cities ci on ci.id = w.city_id
left join public.complexes c on c.id = w.complex_id
left join public.audio_assets atr on atr.id = w.audio_tr_id
left join public.audio_assets aen on aen.id = w.audio_en_id;
