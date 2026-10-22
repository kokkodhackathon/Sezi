-- Eser sayfası: kaynaklı bilgi kartı, sade dil özeti, "Gitmeden önce" ziyaret bilgisi ve admin'in yüklediği fotoğraflar.

-- 1) Bilgi kartı ve özet, metin taslağıyla aynı kitap sayfasından girilir. Yayında esere kopyalanır ve kaynağı
--    (cilt + basılı sayfa + PDF sayfası) esere yazılır: kartta her bilginin hangi sayfadan geldiği gösterilir.
alter table public.text_drafts
  add column built_year integer check (built_year between 1000 and 2100),
  add column founder text,
  add column period jsonb,
  -- Admin'in kitap metninden yazdığı kısa, sade dil özeti {tr, en}
  add column summary jsonb;

alter table public.works
  add column facts_source_id uuid references public.sources (id) on delete set null,
  add column facts_page text,
  add column facts_pdf_page integer;

-- Yayınlanan taslak (ilk yayın ya da yayındayken düzeltme): metin, bilgi kartı ve özet aynı işlemde esere yazılır.
create or replace function public.apply_text_publish() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status <> 'published' then
    return new;
  end if;
  if old.status = 'published' and (new.address, new.history, new.architecture, new.built_year, new.founder, new.period, new.summary)
     is not distinct from (old.address, old.history, old.architecture, old.built_year, old.founder, old.period, old.summary) then
    return new;
  end if;
  if new.address is null and new.history is null and new.architecture is null then
    raise exception 'yayınlanacak metin yok';
  end if;
  update public.works set
    address = new.address, history = new.history, architecture = new.architecture,
    built_year = new.built_year, founder = new.founder, period = new.period, summary = new.summary,
    facts_source_id = case when coalesce(new.built_year::text, new.founder, new.period::text, new.summary::text) is null then null else new.source_id end,
    facts_page = case when coalesce(new.built_year::text, new.founder, new.period::text, new.summary::text) is null then null
                      else new.page::text || coalesce('–' || new.page_end::text, '') end,
    facts_pdf_page = case when coalesce(new.built_year::text, new.founder, new.period::text, new.summary::text) is null then null else new.pdf_page end
  where id = new.work_id;
  if not found then
    raise exception 'eser güncellenemedi (yetki ya da eser yok): %', new.work_id;
  end if;
  return new;
end $$;
revoke execute on function public.apply_text_publish() from public, anon, authenticated;

drop trigger text_drafts_apply on public.text_drafts;
create trigger text_drafts_apply
  before update of status, address, history, architecture, built_year, founder, period, summary on public.text_drafts
  for each row execute function public.apply_text_publish();

-- 2) Gitmeden önce: sahada ya da resmî kaynaktan doğrulanan ziyaret bilgisi. Kaynağı ve tarihi olmadan girilemez.
alter table public.works
  -- Girişteki basamak sayısı (0 = basamaksız)
  add column visit_steps smallint check (visit_steps between 0 and 200),
  add column visit_ramp boolean,
  -- Açık saatler {tr, en} (ör. "Namaz vakitleri dışında 09.00–18.00")
  add column visit_hours jsonb,
  -- Ortalama gezme süresi (dakika)
  add column visit_minutes smallint check (visit_minutes between 1 and 600),
  -- Ek not {tr, en} (ör. "Avluya yan kapıdan basamaksız girilir")
  add column visit_note jsonb,
  -- "Sezi saha gözlemi" ya da kaynak adresi
  add column visit_source text,
  add column visit_checked_on date;

alter table public.works add constraint works_visit_sourced check (
  (visit_steps is null and visit_ramp is null and visit_hours is null and visit_minutes is null and visit_note is null)
  or (nullif(btrim(visit_source), '') is not null and visit_checked_on is not null)
);

-- 3) Admin'in yüklediği fotoğraf: fotoğrafçı/kaynak ve kullanım izni (lisans) olmadan kaydedilemez.
alter table public.media drop constraint media_origin_check;
alter table public.media add constraint media_origin_check check (origin in ('inventory', 'commons', 'upload'));
alter table public.media add constraint media_upload_attribution check (
  origin <> 'upload' or (nullif(btrim(author), '') is not null and nullif(btrim(license), '') is not null)
);

-- works_view: yeni sütunlar sona eklenir (create or replace view sütun sırasını değiştiremez).
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
                     -- Envanter fotoğrafı önce, sonra admin'in yüklediği, en son Commons.
                     order by (case m.origin when 'inventory' then 0 when 'upload' then 1 else 2 end), m.sort_order, m.id)
    from public.media m
    where m.work_id = w.id and m.status = 'verified'
  ), '[]'::jsonb) as photos,
  atr.storage_path as audio_tr,
  aen.storage_path as audio_en,
  (select jsonb_build_object('title', s.title, 'url', s.url, 'volume', s.volume, 'page', w.facts_page, 'pdf_page', w.facts_pdf_page)
   from public.sources s where s.id = w.facts_source_id) as facts_source,
  w.visit_steps, w.visit_ramp, w.visit_hours, w.visit_minutes, w.visit_note, w.visit_source, w.visit_checked_on
from public.works w
join public.work_types t on t.id = w.work_type_id
join public.cities ci on ci.id = w.city_id
left join public.complexes c on c.id = w.complex_id
left join public.audio_assets atr on atr.id = w.audio_tr_id
left join public.audio_assets aen on aen.id = w.audio_en_id;
