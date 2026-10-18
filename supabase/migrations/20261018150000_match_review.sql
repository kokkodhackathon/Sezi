-- Eşleştirme masası: konum adayları ve kitaptan çıkarılan metin taslakları.
-- İkisi de veri hattının (data/) önerisidir; admin onaylayınca `works` alanlarına yazılır.
-- Uygulama bu tabloları okumaz, yalnız `works` / `works_view` okur.

-- Konum adayları: her kaynak bir aday önerir, hiçbiri tek başına karar vermez.
create table public.location_candidates (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  -- current: hattın önceki sonucu · override: data/geo_overrides.json (masa başı OSM doğrulaması)
  source text not null check (source in ('wikidata', 'osm', 'nominatim', 'override', 'current')),
  -- Kaynaktaki kimlik (Q123, way/456); `current` için yöntem adı
  ref text not null,
  label text,
  -- Kaynaktaki varlık türü (work_types.slug sözlüğüyle: cami, cesme, turbe…)
  kind text,
  lng double precision not null check (lng between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  level text not null check (level in ('building', 'street', 'neighbourhood', 'village', 'district')),
  -- 0–1 güven; `reasons` puanın gerekçesi (ad benzerliği, tür, ilçe, uyuşan kaynaklar)
  score real not null default 0 check (score between 0 and 1),
  reasons jsonb not null default '{}'::jsonb,
  -- Tür ya da ilçe çelişkisi: aday reddedilmeye adaydır, admin yine de görebilir
  vetoed boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, source, ref)
);
create index location_candidates_work_idx on public.location_candidates (work_id);
create index location_candidates_decided_by_idx on public.location_candidates (decided_by);

-- Kitaptan çıkarılan metin taslağı (hackathon veri seti: envanter kitapları).
-- Admin kitap sayfasıyla karşılaştırıp düzenler; "Yayınla" works.address/history/architecture'a yazar.
create table public.text_drafts (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  -- Kitap sayfa aralığı (basılı numara)
  page int not null check (page > 0),
  page_end int check (page_end >= page),
  address jsonb check (address is null or public.is_localized(address)),
  history jsonb check (history is null or public.is_localized(history)),
  architecture jsonb check (architecture is null or public.is_localized(architecture)),
  -- Ayrıştırmada kuşku (dil ayrımı, sayfa sınırı): admin dikkatle bakmalı
  warnings text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, source_id, page)
);
create index text_drafts_work_idx on public.text_drafts (work_id);
create index text_drafts_source_idx on public.text_drafts (source_id);
create index text_drafts_decided_by_idx on public.text_drafts (decided_by);

-- Karar verilince kim/ne zaman ve updated_at sunucuda yazılır (istemciye güvenilmez).
create function public.stamp_decision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'pending' then
      new.decided_at := null;
      new.decided_by := null;
    else
      new.decided_at := now();
      new.decided_by := auth.uid();
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.stamp_decision() from public, anon, authenticated;

create trigger location_candidates_stamp before update on public.location_candidates
  for each row execute function public.stamp_decision();
create trigger text_drafts_stamp before update on public.text_drafts
  for each row execute function public.stamp_decision();

-- Yalnız admin: okur ve yazar. Veri hattı service role ile yükler (RLS'i aşar).
alter table public.location_candidates enable row level security;
alter table public.text_drafts enable row level security;
create policy admin_all on public.location_candidates for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_all on public.text_drafts for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
