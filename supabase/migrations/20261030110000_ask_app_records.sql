-- Sezi'ye Sor: eser sayfasında yayımlanan uygulama alanlarını kitap metninden ayrı bir kaynak olarak ara.
-- Böylece adres, konum kesinliği, ziyaret bilgisi, fotoğraf ve sergi bilgisi kitap sayfasına yanlış atfedilmez.

alter table public.doc_chunks drop constraint if exists doc_chunks_section_check;
alter table public.doc_chunks add constraint doc_chunks_section_check
  check (section in ('facts', 'summary', 'history', 'architecture', 'app'));

insert into public.sources (title, publisher, year, kind)
select 'Sezi uygulama kaydı', 'Sezi', 2026, 'other'
where not exists (
  select 1 from public.sources where title = 'Sezi uygulama kaydı' and publisher = 'Sezi' and kind = 'other'
);

-- Yalnız works_view ve eser ekranında herkese açık olan, doğrulanmış alanlar kullanılır.
-- Kullanıcı hesabı, konumu, ziyaret geçmişi ve topluluk fotoğrafları bu metne girmez.
create or replace function public.build_work_app_chunk(p_work_id uuid, p_lang text) returns text
language sql stable set search_path = '' as $$
  select concat_ws('. ',
    (case when p_lang = 'en' then 'Published Sezi app record: ' else 'Sezi uygulamasındaki yayımlanmış eser kaydı: ' end)
      || coalesce(nullif(w.name ->> p_lang, ''), w.name ->> 'tr'),
    (case when p_lang = 'en' then 'Type: ' else 'Tür: ' end)
      || coalesce(nullif(wt.name ->> p_lang, ''), wt.name ->> 'tr'),
    (case when p_lang = 'en' then 'City: ' else 'İl: ' end)
      || coalesce(nullif(ci.name ->> p_lang, ''), ci.name ->> 'tr'),
    case when nullif(w.district, '') is not null
      then (case when p_lang = 'en' then 'District: ' else 'İlçe: ' end) || w.district end,
    case when cx.id is not null
      then (case when p_lang = 'en' then 'Complex: ' else 'Külliye: ' end)
        || coalesce(nullif(cx.name ->> p_lang, ''), cx.name ->> 'tr') end,
    case when w.address is not null
      then (case when p_lang = 'en' then 'Address: ' else 'Adres: ' end)
        || coalesce(nullif(w.address ->> p_lang, ''), w.address ->> 'tr') end,
    case when w.built_year is not null
      then (case when p_lang = 'en' then 'Year built: ' else 'Yapım yılı: ' end) || w.built_year::text end,
    case when nullif(w.founder, '') is not null
      then (case when p_lang = 'en' then 'Founder or patron: ' else 'Yaptıran veya bani: ' end) || w.founder end,
    case when w.period is not null
      then (case when p_lang = 'en' then 'Period: ' else 'Dönem: ' end)
        || coalesce(nullif(w.period ->> p_lang, ''), w.period ->> 'tr') end,
    case when w.condition::text <> 'unknown' then
      (case when p_lang = 'en' then 'Condition: ' else 'Durum: ' end) ||
      case w.condition::text
        when 'intact' then case when p_lang = 'en' then 'intact' else 'ayakta' end
        when 'restored' then case when p_lang = 'en' then 'restored' else 'restore edilmiş' end
        when 'damaged' then case when p_lang = 'en' then 'damaged' else 'hasarlı' end
        when 'destroyed' then case when p_lang = 'en' then 'destroyed' else 'yıkılmış' end
      end
    end,
    case when w.condition_note is not null
      then (case when p_lang = 'en' then 'Condition note: ' else 'Durum notu: ' end)
        || coalesce(nullif(w.condition_note ->> p_lang, ''), w.condition_note ->> 'tr') end,
    case when w.unesco
      then case when p_lang = 'en' then 'Located within a UNESCO World Heritage area' else 'UNESCO Dünya Mirası alanında yer alır' end end,
    (case when p_lang = 'en' then 'Location precision: ' else 'Konum kesinliği: ' end) ||
      case w.location_precision::text
        when 'exact' then case when p_lang = 'en' then 'exact' else 'kesin' end
        when 'approximate' then case when p_lang = 'en' then 'approximate' else 'yaklaşık' end
        else case when p_lang = 'en' then 'not yet verified' else 'henüz doğrulanmadı' end
      end,
    case when w.a11y_score is not null
      then (case when p_lang = 'en' then 'Accessibility score: ' else 'Erişilebilirlik puanı: ' end) || w.a11y_score::text || '/100' end,
    case when w.visit_steps is not null
      then (case when p_lang = 'en' then 'Entrance steps: ' else 'Giriş basamak sayısı: ' end) || w.visit_steps::text end,
    case when w.visit_ramp is not null
      then (case when p_lang = 'en' then 'Entrance ramp: ' else 'Giriş rampası: ' end)
        || case when w.visit_ramp then (case when p_lang = 'en' then 'available' else 'var' end)
                else (case when p_lang = 'en' then 'not available' else 'yok' end) end end,
    case when w.visit_hours is not null
      then (case when p_lang = 'en' then 'Visiting hours: ' else 'Ziyaret saatleri: ' end)
        || coalesce(nullif(w.visit_hours ->> p_lang, ''), w.visit_hours ->> 'tr') end,
    case when w.visit_minutes is not null
      then (case when p_lang = 'en' then 'Suggested visit duration: ' else 'Önerilen ziyaret süresi: ' end)
        || w.visit_minutes::text || case when p_lang = 'en' then ' minutes' else ' dakika' end end,
    case when w.visit_note is not null
      then (case when p_lang = 'en' then 'Visit note: ' else 'Ziyaret notu: ' end)
        || coalesce(nullif(w.visit_note ->> p_lang, ''), w.visit_note ->> 'tr') end,
    case when nullif(w.visit_source, '') is not null
      then (case when p_lang = 'en' then 'Visit information source: ' else 'Ziyaret bilgisinin kaynağı: ' end) || w.visit_source end,
    case when w.visit_checked_on is not null
      then (case when p_lang = 'en' then 'Visit information checked on: ' else 'Ziyaret bilgisi kontrol tarihi: ' end)
        || w.visit_checked_on::text end,
    case when ph.photo_count > 0
      then (case when p_lang = 'en' then 'Published photos in the app: ' else 'Uygulamadaki yayımlanmış fotoğraf sayısı: ' end)
        || ph.photo_count::text end,
    case when ex.items is not null
      then (case when p_lang = 'en' then 'Exhibitions shown in the app: ' else 'Uygulamada gösterilen sergiler: ' end) || ex.items end,
    case when src.items is not null
      then (case when p_lang = 'en' then 'Sources shown in the app: ' else 'Uygulamada gösterilen kaynaklar: ' end) || src.items end
  )
  from public.works w
  join public.work_types wt on wt.id = w.work_type_id
  join public.cities ci on ci.id = w.city_id
  left join public.complexes cx on cx.id = w.complex_id and cx.status = 'verified'
  left join lateral (
    select count(*)::integer as photo_count
    from public.media m where m.work_id = w.id and m.status = 'verified'
  ) ph on true
  left join lateral (
    select string_agg(
      coalesce(nullif(e.title ->> p_lang, ''), e.title ->> 'tr')
        || ' (' || coalesce(nullif(e.venue ->> p_lang, ''), e.venue ->> 'tr') || ')',
      '; ' order by e.starts_on nulls last, e.slug
    ) as items
    from public.work_exhibitions we
    join public.exhibitions e on e.id = we.exhibition_id and e.status = 'verified'
    where we.work_id = w.id
  ) ex on true
  left join lateral (
    select string_agg(
      s.title
        || coalesce(' — ' || case when p_lang = 'en' then 'volume ' else 'cilt ' end || s.volume::text, '')
        || coalesce(', ' || case when p_lang = 'en' then 'page ' else 'sayfa ' end || ws.page, ''),
      '; ' order by (s.kind = 'inventory') desc, s.title
    ) as items
    from public.work_sources ws join public.sources s on s.id = ws.source_id
    where ws.work_id = w.id
  ) src on true
  where w.id = p_work_id and w.status = 'verified'
$$;

revoke execute on function public.build_work_app_chunk(uuid, text) from public, anon, authenticated;

create or replace function public.sync_work_app_chunk() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_source_id uuid;
  v_content text;
  v_lang text;
begin
  delete from public.doc_chunks where work_id = new.id and section = 'app';
  if new.status <> 'verified' then return new; end if;

  select id into v_source_id
  from public.sources
  where title = 'Sezi uygulama kaydı' and publisher = 'Sezi' and kind = 'other'
  order by created_at limit 1;

  foreach v_lang in array array['tr'::text, 'en'::text] loop
    v_content := public.build_work_app_chunk(new.id, v_lang);
    if length(btrim(coalesce(v_content, ''))) >= 20 then
      insert into public.doc_chunks (work_id, source_id, lang, section, chunk_index, page, content)
      values (new.id, v_source_id, v_lang, 'app', 0, null, v_content);
    end if;
  end loop;
  return new;
end $$;

revoke execute on function public.sync_work_app_chunk() from public, anon, authenticated;
create trigger works_zz_sync_app_chunk
  after insert or update on public.works
  for each row execute function public.sync_work_app_chunk();

-- Fotoğraf ve sergi değişince uygulama kaydı da aynı işlem içinde yenilenir.
create or replace function public.touch_ask_app_from_media() returns trigger
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

revoke execute on function public.touch_ask_app_from_media() from public, anon, authenticated;
create trigger media_touch_ask_app
  after insert or update of work_id, status, alt_text, credit or delete on public.media
  for each row execute function public.touch_ask_app_from_media();

create or replace function public.touch_ask_app_from_work_exhibition() returns trigger
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

revoke execute on function public.touch_ask_app_from_work_exhibition() from public, anon, authenticated;
create trigger work_exhibitions_touch_ask_app
  after insert or update of work_id, exhibition_id or delete on public.work_exhibitions
  for each row execute function public.touch_ask_app_from_work_exhibition();

create or replace function public.touch_ask_app_from_exhibition() returns trigger
language plpgsql set search_path = '' as $$
begin
  update public.works w set updated_at = now()
  from public.work_exhibitions we
  where we.exhibition_id = new.id and w.id = we.work_id;
  return new;
end $$;

revoke execute on function public.touch_ask_app_from_exhibition() from public, anon, authenticated;
create trigger exhibitions_touch_ask_app
  after update of title, venue, starts_on, ends_on, status on public.exhibitions
  for each row execute function public.touch_ask_app_from_exhibition();

-- Mevcut doğrulanmış eserler için ilk uygulama parçalarını üret; updated_at değerlerini değiştirme.
insert into public.doc_chunks (work_id, source_id, lang, section, chunk_index, page, content)
select w.id, app_source.id, l.lang, 'app', 0, null, public.build_work_app_chunk(w.id, l.lang)
from public.works w
cross join (values ('tr'::text), ('en'::text)) l(lang)
cross join lateral (
  select id from public.sources
  where title = 'Sezi uygulama kaydı' and publisher = 'Sezi' and kind = 'other'
  order by created_at limit 1
) app_source
where w.status = 'verified'
  and length(btrim(coalesce(public.build_work_app_chunk(w.id, l.lang), ''))) >= 20
on conflict (work_id, source_id, lang, section, chunk_index)
do update set content = excluded.content, page = excluded.page;

-- Uygulama alanı sorularında app bölümü, tarih/mimari sorularında ilgili kitap bölümü önce gelsin.
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
             when lower(p_query) ~ '(adres|nerede|konum|ulaş|ziyaret|açık|saat|basamak|rampa|eriş|fotoğraf|sergi|unesco|durum|address|where|location|visit|open|hour|step|ramp|access|photo|exhibition|condition)'
                  and c.section = 'app' then 0
             when lower(p_query) ~ '(mimari|architecture|architectural)' and c.section = 'architecture' then 0
             when lower(p_query) ~ '(tarihçe|tarihi|history)' and c.section = 'history' then 0
             when lower(p_query) ~ '(kim|yaptır|bani|ne zaman|yıl|who|when|year|founder|commission)' and c.section = 'facts' then 0
             when c.section = 'summary' then 1 when c.section = 'app' then 2 when c.section = 'facts' then 3
             when c.section = 'history' then 4 else 5 end as section_priority
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
