-- Sezi'ye Sor: doğrulanmış eser metinlerinden kaynaklı cevap için arama parçaları ve maliyet sınırı.
-- DeepSeek yalnız cevap üretir; kaynak bulma PostgreSQL tam metin aramasıyla sağlayıcıdan bağımsızdır.

-- Mevcut, boş doc_chunks tablosunu gerçek kaynak parçası deposuna dönüştür.
alter table public.doc_chunks
  add column section text not null default 'history'
    check (section in ('facts', 'summary', 'history', 'architecture')),
  add column chunk_index smallint not null default 0 check (chunk_index between 0 and 500),
  add column page text,
  add column search_vector tsvector generated always as (
    case
      when lang = 'tr' then to_tsvector('pg_catalog.turkish'::regconfig, content)
      else to_tsvector('pg_catalog.english'::regconfig, content)
    end
  ) stored;

create unique index doc_chunks_identity_idx
  on public.doc_chunks (work_id, source_id, lang, section, chunk_index);
create index doc_chunks_search_idx on public.doc_chunks using gin (search_vector);

-- Eser yayına girince ya da doğrulanmış metni değişince parçaları aynı işlemde yenile.
create or replace function public.sync_work_doc_chunks() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_source_id uuid;
  v_page text;
  v_type jsonb;
  v_city jsonb;
begin
  delete from public.doc_chunks where work_id = new.id;
  if new.status <> 'verified' then return new; end if;

  select ws.source_id, ws.page
    into v_source_id, v_page
  from public.work_sources ws
  join public.sources s on s.id = ws.source_id
  where ws.work_id = new.id
  order by (s.kind = 'inventory') desc, s.title
  limit 1;

  if new.facts_source_id is not null then
    v_source_id := new.facts_source_id;
    v_page := new.facts_page;
  end if;
  if v_source_id is null then return new; end if;
  select t.name, ci.name into v_type, v_city
  from public.work_types t, public.cities ci
  where t.id = new.work_type_id and ci.id = new.city_id;

  insert into public.doc_chunks (work_id, source_id, lang, section, chunk_index, page, content)
  with localized as (
    select l.lang, x.section, x.content
    from (values ('tr'::text), ('en'::text)) l(lang)
    cross join lateral (values
      ('facts'::text, concat_ws('. ',
        case when l.lang = 'tr' then 'Eser: ' else 'Site: ' end || coalesce(nullif(new.name ->> l.lang, ''), new.name ->> 'tr'),
        case when l.lang = 'tr' then 'Tür: ' else 'Type: ' end || coalesce(nullif(v_type ->> l.lang, ''), v_type ->> 'tr'),
        case when l.lang = 'tr' then 'İl: ' else 'City: ' end || coalesce(nullif(v_city ->> l.lang, ''), v_city ->> 'tr'),
        case when nullif(new.district, '') is not null then (case when l.lang = 'tr' then 'İlçe: ' else 'District: ' end) || new.district end,
        case when new.built_year is not null then (case when l.lang = 'tr' then 'Yapım yılı: ' else 'Year built: ' end) || new.built_year::text end,
        case when nullif(new.founder, '') is not null then (case when l.lang = 'tr' then 'Yaptıran: ' else 'Founder: ' end) || new.founder end,
        case when new.period is not null then (case when l.lang = 'tr' then 'Dönem: ' else 'Period: ' end) || coalesce(nullif(new.period ->> l.lang, ''), new.period ->> 'tr') end
      )),
      ('summary', coalesce(nullif(new.summary ->> l.lang, ''), case when l.lang = 'en' then new.summary ->> 'tr' end)),
      ('history', coalesce(nullif(new.history ->> l.lang, ''), case when l.lang = 'en' then new.history ->> 'tr' end)),
      ('architecture', coalesce(nullif(new.architecture ->> l.lang, ''), case when l.lang = 'en' then new.architecture ->> 'tr' end))
    ) x(section, content)
  ), paragraphs as (
    select lang, section, btrim(paragraph) as paragraph
    from localized
    cross join lateral regexp_split_to_table(coalesce(content, ''), E'\\n\\s*\\n') paragraph
    where nullif(btrim(content), '') is not null
  ), pieces as (
    select lang, section, substring(paragraph from pos for 1800) as content
    from paragraphs
    cross join lateral generate_series(1, greatest(length(paragraph), 1), 1800) pos
  ), numbered as (
    select lang, section, content,
           (row_number() over (partition by lang, section order by content) - 1)::smallint as chunk_index
    from pieces where length(btrim(content)) >= 20
  )
  select new.id, v_source_id, lang, section, chunk_index, v_page, content from numbered;
  return new;
end $$;

revoke execute on function public.sync_work_doc_chunks() from public, anon, authenticated;
create trigger works_sync_doc_chunks
  after insert or update of status, name, work_type_id, city_id, district, summary, history, architecture, built_year, founder, period, facts_source_id, facts_page, updated_at
  on public.works for each row execute function public.sync_work_doc_chunks();

-- Kaynak bağı eser oluşturulduktan sonra eklenebilir. Bağ veya sayfa değişince eser tetikleyicisini çalıştır;
-- böylece yeni doğrulanmış eser kaynak sırasından bağımsız olarak aramaya girer.
create or replace function public.touch_ask_chunks_from_work_source() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.works set updated_at = now() where id = old.work_id;
    return old;
  end if;
  update public.works set updated_at = now() where id = new.work_id;
  if tg_op = 'UPDATE' and old.work_id is distinct from new.work_id then
    update public.works set updated_at = now() where id = old.work_id;
  end if;
  return new;
end $$;
revoke execute on function public.touch_ask_chunks_from_work_source() from public, anon, authenticated;
create trigger work_sources_sync_doc_chunks
  after insert or update of work_id, source_id, page or delete on public.work_sources
  for each row execute function public.touch_ask_chunks_from_work_source();

-- Var olan doğrulanmış eserleri bir kez parçala. Sonraki değişiklikler tetikleyiciyle gelir.
insert into public.doc_chunks (work_id, source_id, lang, section, chunk_index, page, content)
with preferred_source as (
  select w.id as work_id,
         coalesce(w.facts_source_id, p.source_id) as source_id,
         case when w.facts_source_id is not null then w.facts_page else p.page end as page
  from public.works w
  left join lateral (
    select ws.source_id, ws.page
    from public.work_sources ws join public.sources s on s.id = ws.source_id
    where ws.work_id = w.id
    order by (s.kind = 'inventory') desc, s.title
    limit 1
  ) p on true
  where w.status = 'verified'
), localized as (
  select w.id as work_id, ps.source_id, ps.page, l.lang, x.section, x.content
  from public.works w join preferred_source ps on ps.work_id = w.id and ps.source_id is not null
  join public.work_types wt on wt.id = w.work_type_id
  join public.cities ci on ci.id = w.city_id
  cross join (values ('tr'::text), ('en'::text)) l(lang)
  cross join lateral (values
    ('facts'::text, concat_ws('. ',
      case when l.lang = 'tr' then 'Eser: ' else 'Site: ' end || coalesce(nullif(w.name ->> l.lang, ''), w.name ->> 'tr'),
      case when l.lang = 'tr' then 'Tür: ' else 'Type: ' end || coalesce(nullif(wt.name ->> l.lang, ''), wt.name ->> 'tr'),
      case when l.lang = 'tr' then 'İl: ' else 'City: ' end || coalesce(nullif(ci.name ->> l.lang, ''), ci.name ->> 'tr'),
      case when nullif(w.district, '') is not null then (case when l.lang = 'tr' then 'İlçe: ' else 'District: ' end) || w.district end,
      case when w.built_year is not null then (case when l.lang = 'tr' then 'Yapım yılı: ' else 'Year built: ' end) || w.built_year::text end,
      case when nullif(w.founder, '') is not null then (case when l.lang = 'tr' then 'Yaptıran: ' else 'Founder: ' end) || w.founder end,
      case when w.period is not null then (case when l.lang = 'tr' then 'Dönem: ' else 'Period: ' end) || coalesce(nullif(w.period ->> l.lang, ''), w.period ->> 'tr') end
    )),
    ('summary', coalesce(nullif(w.summary ->> l.lang, ''), case when l.lang = 'en' then w.summary ->> 'tr' end)),
    ('history', coalesce(nullif(w.history ->> l.lang, ''), case when l.lang = 'en' then w.history ->> 'tr' end)),
    ('architecture', coalesce(nullif(w.architecture ->> l.lang, ''), case when l.lang = 'en' then w.architecture ->> 'tr' end))
  ) x(section, content)
), paragraphs as (
  select work_id, source_id, page, lang, section, btrim(paragraph) as paragraph
  from localized
  cross join lateral regexp_split_to_table(coalesce(content, ''), E'\\n\\s*\\n') paragraph
  where nullif(btrim(content), '') is not null
), pieces as (
  select work_id, source_id, page, lang, section, substring(paragraph from pos for 1800) as content
  from paragraphs
  cross join lateral generate_series(1, greatest(length(paragraph), 1), 1800) pos
), numbered as (
  select work_id, source_id, page, lang, section, content,
         (row_number() over (partition by work_id, source_id, lang, section order by content) - 1)::smallint as chunk_index
  from pieces where length(btrim(content)) >= 20
)
select work_id, source_id, lang, section, chunk_index, page, content from numbered
on conflict (work_id, source_id, lang, section, chunk_index) do update set content = excluded.content, page = excluded.page;

-- Aday eserler (istemcideki yerel arama) her zaman bağlama girer; ayrıca bütün parçalar tam metinle aranır.
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
  ), ranked as (
    select *, row_number() over (
      partition by work_id order by section_priority, text_rank desc, chunk_index
    ) as work_rank
    from base
  )
  select r.id, r.slug, r.work_name, r.section, r.content, r.title, r.publisher, r.year, r.url, r.volume, r.page,
         (case when r.candidate then 10 else 0 end + r.text_rank)::real
  from ranked r
  where r.work_rank <= per_work
  order by r.candidate desc, r.candidate_pos nulls last, r.section_priority, r.text_rank desc, r.chunk_index
  limit least(greatest(coalesce(p_limit, 12), 1), 16);
end $$;

revoke all on function public.search_ask_chunks(text, text, text[], integer) from public, anon, authenticated;
grant execute on function public.search_ask_chunks(text, text, text[], integer) to service_role;

-- Ham cihaz/IP tutulmaz. Edge Function HMAC özetini yollar ve bu işlem atomik biçimde kota ayırır.
create table public.ask_usage (
  id bigint generated always as identity primary key,
  subject_hash text not null check (length(subject_hash) = 64),
  prompt_chars smallint not null check (prompt_chars between 2 and 240),
  provider text not null check (length(provider) between 1 and 32),
  model text not null check (length(model) between 1 and 80),
  created_at timestamptz not null default now()
);
create index ask_usage_subject_time_idx on public.ask_usage (subject_hash, created_at desc);
create index ask_usage_created_at_idx on public.ask_usage (created_at);
alter table public.ask_usage enable row level security;

create or replace function public.reserve_ask_usage(
  p_subject_hash text, p_prompt_chars integer, p_provider text, p_model text
) returns boolean
language plpgsql set search_path = '' as $$
begin
  if p_subject_hash !~ '^[0-9a-f]{64}$' or p_prompt_chars not between 2 and 240 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject_hash, 0));
  -- Kota kayıtları kişisel veri değildir ama yine de gereksiz saklanmaz.
  delete from public.ask_usage where created_at < now() - interval '2 days';
  if (select count(*) from public.ask_usage where subject_hash = p_subject_hash and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from public.ask_usage where subject_hash = p_subject_hash and created_at > now() - interval '1 day') >= 60 then
    return false;
  end if;
  insert into public.ask_usage (subject_hash, prompt_chars, provider, model)
  values (p_subject_hash, p_prompt_chars, left(p_provider, 32), left(p_model, 80));
  return true;
end $$;

revoke all on function public.reserve_ask_usage(text, integer, text, text) from public, anon, authenticated;
grant execute on function public.reserve_ask_usage(text, integer, text, text) to service_role;
