-- Takip ve geniş sorularda tek bölümün kısa/alakasız paragrafları bağlamı doldurmasın.
-- Her eser için önce ilgili bölümden, sonra özet/olgu/diğer bölümlerden dengeli parçalar seçilir.
create or replace function public.search_ask_chunks(
  p_query text,
  p_lang text,
  p_work_slugs text[] default '{}',
  p_limit integer default 12
) returns table (
  chunk_id uuid, work_slug text, work_name text, section text, content text,
  source_title text, source_publisher text, source_year integer, source_url text,
  source_volume integer, source_page text, rank real
)
language plpgsql stable set search_path = '' as $$
declare
  cfg regconfig := case when p_lang = 'en' then 'pg_catalog.english'::regconfig else 'pg_catalog.turkish'::regconfig end;
  q tsquery := websearch_to_tsquery(cfg, left(coalesce(p_query, ''), 240));
  per_work integer := case
    when cardinality(coalesce(p_work_slugs, '{}'::text[])) > 4 then 2
    when cardinality(coalesce(p_work_slugs, '{}'::text[])) > 1 then 3
    when cardinality(coalesce(p_work_slugs, '{}'::text[])) = 1 then 8
    else 2 end;
begin
  return query
  with base as (
    select c.id, c.work_id, w.slug, coalesce(nullif(w.name ->> p_lang, ''), w.name ->> 'tr') as work_name,
           c.section, c.content, s.title, s.publisher, s.year, s.url, s.volume, c.page, c.chunk_index,
           (w.slug = any(coalesce(p_work_slugs, '{}'::text[]))) as candidate,
           array_position(coalesce(p_work_slugs, '{}'::text[]), w.slug) as candidate_pos,
           ts_rank_cd(c.search_vector, q) as text_rank,
           case
             when lower(p_query) ~ '(mimari|architecture|architectural)' and c.section = 'architecture' then 0
             when lower(p_query) ~ '(tarihçe|tarihi|history)' and c.section = 'history' then 0
             when lower(p_query) ~ '(kim|yaptır|bani|ne zaman|yıl|who|when|year|founder|commission)' and c.section = 'facts' then 0
             when c.section = 'summary' then 1 when c.section = 'facts' then 2
             when c.section = 'history' then 3 else 4 end as section_priority
    from public.doc_chunks c
    join public.works w on w.id = c.work_id and w.status = 'verified'
    join public.sources s on s.id = c.source_id
    where c.lang = case when p_lang = 'en' then 'en' else 'tr' end
      and (w.slug = any(coalesce(p_work_slugs, '{}'::text[])) or (numnode(q) > 0 and c.search_vector @@ q))
  ), sectioned as (
    select b.*, row_number() over (
      partition by b.work_id, b.section order by b.text_rank desc, length(b.content) desc, b.chunk_index
    ) as section_rank
    from base b
  ), ranked as (
    select s.*, row_number() over (
      partition by s.work_id order by s.section_rank, s.section_priority, s.text_rank desc, length(s.content) desc, s.chunk_index
    ) as work_rank
    from sectioned s
  )
  select r.id, r.slug, r.work_name, r.section, r.content, r.title, r.publisher, r.year, r.url, r.volume, r.page,
         (case when r.candidate then 10 else 0 end + r.text_rank)::real
  from ranked r
  where r.work_rank <= per_work
  order by r.candidate desc, r.candidate_pos nulls last, r.section_priority, r.section_rank, r.text_rank desc, r.chunk_index
  limit least(greatest(coalesce(p_limit, 12), 1), 16);
end $$;

revoke all on function public.search_ask_chunks(text, text, text[], integer) from public, anon, authenticated;
grant execute on function public.search_ask_chunks(text, text, text[], integer) to service_role;
