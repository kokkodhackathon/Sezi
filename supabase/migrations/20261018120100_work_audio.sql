-- Eserlere TR/EN ses kaydı: varsa uygulamada metin okuması yerine çalar.
alter table public.works
  add column audio_tr_id uuid references public.audio_assets(id) on delete set null,
  add column audio_en_id uuid references public.audio_assets(id) on delete set null;

create index works_audio_tr_idx on public.works (audio_tr_id);
create index works_audio_en_idx on public.works (audio_en_id);

-- works_view: ses dosyası yolları eklenir (geri kalan tanım 20261014120000_media_photos.sql ile aynı).
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
  ), '[]'::jsonb) as photos,
  atr.storage_path as audio_tr, aen.storage_path as audio_en
from public.works w
join public.work_types t on t.id = w.work_type_id
join public.cities ci on ci.id = w.city_id
left join public.complexes c on c.id = w.complex_id
left join public.audio_assets atr on atr.id = w.audio_tr_id
left join public.audio_assets aen on aen.id = w.audio_en_id;

grant select on public.works_view to anon, authenticated;
