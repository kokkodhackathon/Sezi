-- Envanter fotoğraf arşivi (Vakıf Katılım, Bursa örneklemi, 14 Ekim 2026 paylaşımı).
-- Her fotoğraf iki boyutta saklanır: liste kartı için küçük, detay için büyük.

alter table public.media
  add column kind text not null default 'photo' check (kind in ('photo', 'aerial', 'inscription')),
  add column width int,
  add column height int,
  add column thumb_path text,
  -- Arşivdeki özgün dosya (eşleştirme denetimi ve yeniden işleme için)
  add column source_file text,
  -- Kitapta bulunduğu yer: fotoğraf → sayfa → eser eşleşmesinin dayanağı
  add column source_volume int,
  add column source_page int;

create unique index media_source_file_idx on public.media (source_file) where source_file is not null;

-- works_view: kapak fotoğrafı ve galeri (yalnızca doğrulanmış medya; anonim RLS zaten süzer)
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
  ), '[]'::jsonb) as exhibitions,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'path', m.storage_path, 'thumb', m.thumb_path, 'alt', m.alt_text,
                                        'credit', m.credit, 'kind', m.kind, 'width', m.width, 'height', m.height)
                     order by m.sort_order, m.id)
    from public.media m
    where m.work_id = w.id and m.status = 'verified'
  ), '[]'::jsonb) as photos
from public.works w
join public.work_types t on t.id = w.work_type_id
join public.cities ci on ci.id = w.city_id
left join public.complexes c on c.id = w.complex_id;

grant select on public.works_view to anon, authenticated;
