-- Sezi: başlangıç şeması
-- İçerik alanları {tr, en} jsonb. Konumlar WGS84 geography.
-- Eklentiler `extensions` şemasında: public API'ye PostGIS fonksiyonları/tabloları açılmaz.

create extension if not exists postgis with schema extensions;
create extension if not exists vector with schema extensions;

create type public.content_status as enum ('draft', 'verified', 'archived');
create type public.lynch_type as enum ('landmark', 'node', 'district_gate');
create type public.surface_type as enum ('asphalt', 'paving', 'cobble', 'gravel', 'marble');
create type public.cue_type as enum ('sound', 'visual', 'tactile', 'generic');
create type public.report_type as enum ('stairs', 'ramp_blocked', 'narrow_path', 'surface_damage', 'construction', 'other');
create type public.report_status as enum ('pending', 'approved', 'rejected');

-- Admin rolü JWT app_metadata.role üzerinden verilir (kullanıcı değiştiremez; user_metadata değil).
create or replace function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Çok dilli metin doğrulaması: tr zorunlu.
create or replace function public.is_localized(t jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select t is null or (jsonb_typeof(t) = 'object' and coalesce(length(trim(t ->> 'tr')), 0) > 0)
$$;

-- ---------- Coğrafya & sınıflandırma ----------

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null check (public.is_localized(name))
);

create table public.cities (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(id),
  name jsonb not null check (public.is_localized(name)),
  center extensions.geography(point, 4326)
);
create index cities_region_idx on public.cities (region_id);

create table public.work_types (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- cami, medrese, sebil, han, hamam, imaret, turbe...
  name jsonb not null check (public.is_localized(name))
);

create table public.complexes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  city_id uuid not null references public.cities(id),
  name jsonb not null check (public.is_localized(name)),
  summary jsonb check (public.is_localized(summary)),
  status public.content_status not null default 'draft',
  updated_at timestamptz not null default now()
);
create index complexes_city_idx on public.complexes (city_id);

-- ---------- Eserler & kaynaklar ----------

create table public.works (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name jsonb not null check (public.is_localized(name)),
  summary jsonb check (public.is_localized(summary)),
  history jsonb check (public.is_localized(history)),
  work_type_id uuid not null references public.work_types(id),
  city_id uuid not null references public.cities(id),
  complex_id uuid references public.complexes(id),
  location extensions.geography(point, 4326) not null,
  built_year int,
  founder text,
  a11y_score numeric(5,2) check (a11y_score between 0 and 100),
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index works_location_idx on public.works using gist (location);
create index works_city_idx on public.works (city_id);
create index works_complex_idx on public.works (complex_id);
create index works_type_idx on public.works (work_type_id);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  author text,
  publisher text,
  year int check (year between 1000 and 2100),
  url text check (url is null or url ~ '^https?://'),
  created_at timestamptz not null default now()
);

create table public.work_sources (
  work_id uuid references public.works(id) on delete cascade,
  source_id uuid references public.sources(id) on delete restrict,
  page text,
  primary key (work_id, source_id)
);
create index work_sources_source_idx on public.work_sources (source_id);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  storage_path text not null,
  alt_text jsonb not null check (public.is_localized(alt_text)),
  credit text,
  sort_order int not null default 0,
  status public.content_status not null default 'draft'
);
create index media_work_idx on public.media (work_id);

create table public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  label text not null,
  description jsonb check (public.is_localized(description)),  -- altyazı / betimleme
  recorded_at date,
  duration_s numeric(6,2)
);

-- ---------- Navigasyon (Lynch grafiği) ----------

create table public.nav_nodes (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes(id) on delete cascade,
  lynch_type public.lynch_type not null,
  name jsonb check (public.is_localized(name)),
  location extensions.geography(point, 4326) not null,
  visibility_deg numeric(5,2) check (visibility_deg between 0 and 360),
  sound_asset_id uuid references public.audio_assets(id),
  work_id uuid references public.works(id),
  updated_at timestamptz not null default now()
);
create index nav_nodes_complex_idx on public.nav_nodes (complex_id);
create index nav_nodes_location_idx on public.nav_nodes using gist (location);
create index nav_nodes_sound_idx on public.nav_nodes (sound_asset_id);
create index nav_nodes_work_idx on public.nav_nodes (work_id);

create table public.nav_segments (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes(id) on delete cascade,
  from_node uuid not null references public.nav_nodes(id) on delete cascade,
  to_node uuid not null references public.nav_nodes(id) on delete cascade,
  geom extensions.geography(linestring, 4326),
  length_m numeric(8,2) not null check (length_m > 0),
  steps int not null default 0 check (steps >= 0),
  slope_pct numeric(5,2) not null default 0 check (slope_pct >= 0),
  surface public.surface_type not null default 'paving',
  width_cm int check (width_cm > 0),
  kerb boolean not null default false,
  noise numeric(3,2) not null default 0 check (noise between 0 and 1),
  landmark_visibility numeric(3,2) not null default 0 check (landmark_visibility between 0 and 1),
  blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  check (from_node <> to_node)
);
create index nav_segments_complex_idx on public.nav_segments (complex_id);
create index nav_segments_from_idx on public.nav_segments (from_node);
create index nav_segments_to_idx on public.nav_segments (to_node);

create table public.instructions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references public.nav_nodes(id) on delete cascade,
  approach_from uuid references public.nav_nodes(id) on delete cascade,
  text jsonb not null check (public.is_localized(text)),
  cue_type public.cue_type not null,
  status public.content_status not null default 'draft',
  updated_at timestamptz not null default now()
);
create index instructions_node_idx on public.instructions (node_id);
create index instructions_approach_idx on public.instructions (approach_from);

-- ---------- Topluluk: erişilebilirlik bildirimi ----------

create table public.a11y_reports (
  id uuid primary key default gen_random_uuid(),
  segment_id uuid not null references public.nav_segments(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type public.report_type not null,
  note text check (length(note) <= 500),
  photo_path text,
  status public.report_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index a11y_reports_status_idx on public.a11y_reports (status);
create index a11y_reports_segment_idx on public.a11y_reports (segment_id);
create index a11y_reports_user_idx on public.a11y_reports (user_id);
create index a11y_reports_reviewer_idx on public.a11y_reports (reviewed_by);

-- Onaylanan bildirim segment özelliklerini günceller → rota motoru otomatik kaçınır.
-- SECURITY INVOKER: güncellemeyi yapan admin'in nav_segments yazma yetkisiyle çalışır.
create or replace function public.apply_a11y_report() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.nav_segments set
      steps    = case when new.type = 'stairs' then greatest(steps, 1) else steps end,
      width_cm = case when new.type = 'narrow_path' then least(coalesce(width_cm, 80), 80) else width_cm end,
      blocked  = blocked or new.type in ('ramp_blocked', 'construction')
    where id = new.segment_id;
    new.reviewed_at = now();
    new.reviewed_by = auth.uid();
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.reviewed_at = now();
    new.reviewed_by = auth.uid();
  end if;
  return new;
end $$;

create trigger a11y_reports_apply before update on public.a11y_reports
  for each row execute function public.apply_a11y_report();

-- ---------- RAG ----------
-- Boyutsuz vector: embedding sağlayıcısı henüz seçilmedi. Seçilince boyut sabitlenip HNSW index eklenecek.
create table public.doc_chunks (
  id uuid primary key default gen_random_uuid(),
  work_id uuid references public.works(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  lang text not null check (lang in ('tr', 'en')),
  content text not null,
  embedding extensions.vector,
  created_at timestamptz not null default now()
);
create index doc_chunks_work_idx on public.doc_chunks (work_id);
create index doc_chunks_source_idx on public.doc_chunks (source_id);

-- ---------- updated_at tetikleyicileri ----------
create trigger complexes_updated before update on public.complexes for each row execute function public.set_updated_at();
create trigger works_updated before update on public.works for each row execute function public.set_updated_at();
create trigger nav_nodes_updated before update on public.nav_nodes for each row execute function public.set_updated_at();
create trigger nav_segments_updated before update on public.nav_segments for each row execute function public.set_updated_at();
create trigger instructions_updated before update on public.instructions for each row execute function public.set_updated_at();

-- Tetikleyici fonksiyonları API'den (/rpc) çağrılamasın.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.apply_a11y_report() from public, anon, authenticated;

-- ---------- RLS ----------
-- Okuma: herkes yalnızca doğrulanmış içeriği görür (admin hepsini).
-- Yazma: admin. Politikalar komut başına ayrı → SELECT için tek permissive politika.

alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.work_types enable row level security;
alter table public.complexes enable row level security;
alter table public.works enable row level security;
alter table public.sources enable row level security;
alter table public.work_sources enable row level security;
alter table public.media enable row level security;
alter table public.audio_assets enable row level security;
alter table public.nav_nodes enable row level security;
alter table public.nav_segments enable row level security;
alter table public.instructions enable row level security;
alter table public.a11y_reports enable row level security;
alter table public.doc_chunks enable row level security;

-- Sınıflandırma ve kaynak tabloları: herkese açık okuma.
create policy read_all on public.regions      for select to anon, authenticated using (true);
create policy read_all on public.cities       for select to anon, authenticated using (true);
create policy read_all on public.work_types   for select to anon, authenticated using (true);
create policy read_all on public.sources      for select to anon, authenticated using (true);
create policy read_all on public.work_sources for select to anon, authenticated using (true);
create policy read_all on public.audio_assets for select to anon, authenticated using (true);

-- Durum alanı olan içerik.
create policy read_verified on public.complexes    for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.works        for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.media        for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));
create policy read_verified on public.instructions for select to anon, authenticated using (status = 'verified' or (select public.is_admin()));

-- Navigasyon grafiği: bağlı külliye yayındaysa açık.
create policy read_published on public.nav_nodes for select to anon, authenticated using (
  (select public.is_admin()) or exists (select 1 from public.complexes c where c.id = complex_id and c.status = 'verified'));
create policy read_published on public.nav_segments for select to anon, authenticated using (
  (select public.is_admin()) or exists (select 1 from public.complexes c where c.id = complex_id and c.status = 'verified'));

-- RAG parçaları istemciye açılmaz; edge function service role ile okur.
create policy admin_read on public.doc_chunks for select to authenticated using ((select public.is_admin()));

-- Admin yazma politikaları (insert / update / delete ayrı).
do $$
declare t text;
begin
  foreach t in array array['regions','cities','work_types','complexes','works','sources','work_sources',
                           'media','audio_assets','nav_nodes','nav_segments','instructions','doc_chunks']
  loop
    execute format('create policy admin_insert on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy admin_update on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy admin_delete on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Bildirimler: giriş yapmış kullanıcı ekler ve kendininkini görür; admin hepsini yönetir.
create policy insert_own on public.a11y_reports for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy read_own on public.a11y_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy admin_review on public.a11y_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.a11y_reports for delete to authenticated
  using ((select public.is_admin()));

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values
  ('media', 'media', true),
  ('audio', 'audio', true),
  ('reports', 'reports', false)
on conflict (id) do nothing;

-- media/audio: herkese açık bucket (URL ile okunur); yükleme/değiştirme/silme admin.
create policy media_audio_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('media', 'audio') and (select public.is_admin()));
create policy media_audio_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('media', 'audio') and (select public.is_admin()))
  with check (bucket_id in ('media', 'audio') and (select public.is_admin()));
create policy media_audio_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('media', 'audio') and (select public.is_admin()));

-- Bildirim fotoğrafları: kullanıcı kendi klasörüne (<uid>/...) yükler, kendi ve admin okur.
create policy reports_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy objects_read on storage.objects for select to authenticated
  using (
    (bucket_id in ('media', 'audio') and (select public.is_admin()))
    or (bucket_id = 'reports' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())))
  );
