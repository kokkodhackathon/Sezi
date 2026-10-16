-- Anlatım noktaları: yürüyüşte kullanıcı yaklaşınca açılan metin/ses (admin panelinden girilir).
create table public.story_points (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.cities(id),
  title jsonb not null check (public.is_localized(title)),
  body jsonb check (public.is_localized(body)),            -- pop-up metni ve TTS kaynağı
  audio_tr_id uuid references public.audio_assets(id) on delete set null,
  audio_en_id uuid references public.audio_assets(id) on delete set null,
  location extensions.geography(point, 4326) not null,
  radius_m int not null default 25 check (radius_m between 5 and 200),
  source_note text,                                        -- metnin/kaydın kaynağı (kural 3)
  status public.content_status not null default 'draft',
  updated_at timestamptz not null default now(),
  -- Yayındaki noktanın metni ve kaynağı olmalı: ses her zaman yazılı karşılıkla gelir (işitme profili).
  constraint story_points_verified_complete check (
    status <> 'verified' or (body is not null and source_note is not null and length(trim(source_note)) > 0))
);
create index story_points_city_idx on public.story_points (city_id);
create index story_points_location_idx on public.story_points using gist (location);
create index story_points_audio_tr_idx on public.story_points (audio_tr_id);
create index story_points_audio_en_idx on public.story_points (audio_en_id);

create trigger story_points_updated before update on public.story_points for each row execute function public.set_updated_at();

-- Okuma: herkes yalnızca doğrulanmış noktaları görür (admin hepsini). Yazma: admin.
alter table public.story_points enable row level security;
create policy read_verified on public.story_points for select to anon, authenticated
  using (status = 'verified' or (select public.is_admin()));
create policy admin_insert on public.story_points for insert to authenticated with check ((select public.is_admin()));
create policy admin_update on public.story_points for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy admin_delete on public.story_points for delete to authenticated using ((select public.is_admin()));

-- İstemci görünümü: koordinatlar lng/lat, il slug'ı ve ses dosyası yolları tek satırda.
-- security_invoker: RLS çağıranın yetkisiyle uygulanır.
create view public.story_points_view with (security_invoker = true) as
select
  p.id, p.city_id, c.slug as city_slug, p.title, p.body, p.radius_m, p.source_note, p.status, p.updated_at,
  extensions.st_x(p.location::extensions.geometry) as lng,
  extensions.st_y(p.location::extensions.geometry) as lat,
  p.audio_tr_id, atr.storage_path as audio_tr,
  p.audio_en_id, aen.storage_path as audio_en
from public.story_points p
join public.cities c on c.id = p.city_id
left join public.audio_assets atr on atr.id = p.audio_tr_id
left join public.audio_assets aen on aen.id = p.audio_en_id;

grant select on public.story_points_view to anon, authenticated;
