-- İstemci için eser görünümü: koordinatlar lng/lat, tür ve külliye adı, kaynaklar tek sorguda.
-- security_invoker: RLS çağıranın yetkisiyle uygulanır (anonim yalnızca verified eserleri görür).
create view public.works_view with (security_invoker = true) as
select
  w.id, w.slug, w.name, w.summary, w.history, w.built_year, w.founder, w.a11y_score, w.status,
  t.slug as type_slug, t.name as type_name,
  c.slug as complex_slug, c.name as complex_name,
  extensions.st_x(w.location::extensions.geometry) as lng,
  extensions.st_y(w.location::extensions.geometry) as lat,
  coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'publisher', s.publisher,
                                        'year', s.year, 'url', s.url, 'page', ws.page) order by s.title)
    from public.work_sources ws join public.sources s on s.id = ws.source_id
    where ws.work_id = w.id
  ), '[]'::jsonb) as sources
from public.works w
join public.work_types t on t.id = w.work_type_id
left join public.complexes c on c.id = w.complex_id;

grant select on public.works_view to anon, authenticated;
