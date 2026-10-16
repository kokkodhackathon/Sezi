-- Noktalar: rotaların uğradığı ve kullandığı her yer tek tabloda (admin panelinden girilir, kodda sabit nokta yok).
-- Bir yer birden çok rol taşıyabilir: Heykel hem başlangıç hem yer işaretidir.
--   start     başlangıç / buluşma noktası ("Neredesiniz?")
--   landmark  yer işareti: talimatlarda anılır, görünen yol tercih edilir, ortam sesi verebilir
--   story     anlatım noktası: yarıçapa girilince metin/ses açılır, rota yakındakilere uğrar
--   arrival   eser varış bilgisi: esere varınca açılan metin/ses (work_id zorunlu)
create type public.nav_point_role as enum ('start', 'landmark', 'story', 'arrival');

drop view public.story_points_view;
alter table public.story_points rename to nav_points;
alter table public.nav_points drop constraint story_points_verified_complete;
alter index public.story_points_pkey rename to nav_points_pkey;
alter index public.story_points_city_idx rename to nav_points_city_idx;
alter index public.story_points_location_idx rename to nav_points_location_idx;
alter index public.story_points_audio_tr_idx rename to nav_points_audio_tr_idx;
alter index public.story_points_audio_en_idx rename to nav_points_audio_en_idx;
alter trigger story_points_updated on public.nav_points rename to nav_points_updated;
alter table public.nav_points rename constraint story_points_city_id_fkey to nav_points_city_id_fkey;
alter table public.nav_points rename constraint story_points_audio_tr_id_fkey to nav_points_audio_tr_id_fkey;
alter table public.nav_points rename constraint story_points_audio_en_id_fkey to nav_points_audio_en_id_fkey;
alter table public.nav_points rename constraint story_points_title_check to nav_points_title_check;
alter table public.nav_points rename constraint story_points_body_check to nav_points_body_check;
alter table public.nav_points rename constraint story_points_radius_m_check to nav_points_radius_m_check;

alter table public.nav_points
  add column roles public.nav_point_role[] not null default '{story}' check (cardinality(roles) >= 1),
  add column work_id uuid references public.works(id) on delete cascade,
  -- Yer işaretinin belirginliği (Sorrows & Hirtle): uzaktan görünürlük 1–3; rota tercihini etkiler.
  add column salience smallint check (salience between 1 and 3),
  -- Ses manzarasında bu noktadan gelen ortam sesi.
  add column ambient text check (ambient in ('water', 'market', 'chime')),
  -- Belirginlik ve konum sahada gözlemlendi mi (insanlar burada buluşuyor mu, buradan yön buluyor mu).
  add column field_checked boolean not null default false,
  -- Başlangıç listesindeki sıra; en küçük olan varsayılan başlangıçtır.
  add column sort_order int not null default 0,
  -- Varış bilgisi bir esere bağlıdır; esere bağlı nokta varış bilgisidir.
  add constraint nav_points_arrival_work check (('arrival' = any(roles)) = (work_id is not null)),
  -- Yayındaki noktanın kaynağı olmalı (kural 3); anlatım ve varışta metin de olmalı:
  -- ses her zaman yazılı karşılıkla gelir (işitme profili).
  add constraint nav_points_verified_complete check (
    status <> 'verified' or (
      source_note is not null and length(trim(source_note)) > 0
      and (body is not null or not (roles && '{story,arrival}'::public.nav_point_role[]))));

create index nav_points_work_idx on public.nav_points (work_id);
-- Bir esere yayında tek varış bilgisi.
create unique index nav_points_arrival_unique on public.nav_points (work_id) where status = 'verified';

-- İstemci görünümü: koordinatlar lng/lat, il ve eser slug'ı, ses dosyası yolları tek satırda.
create view public.nav_points_view with (security_invoker = true) as
select
  p.id, p.city_id, c.slug as city_slug, p.roles, p.title, p.body, p.radius_m, p.source_note, p.status, p.updated_at,
  extensions.st_x(p.location::extensions.geometry) as lng,
  extensions.st_y(p.location::extensions.geometry) as lat,
  p.work_id, w.slug as work_slug, p.salience, p.ambient, p.field_checked, p.sort_order,
  p.audio_tr_id, atr.storage_path as audio_tr,
  p.audio_en_id, aen.storage_path as audio_en
from public.nav_points p
join public.cities c on c.id = p.city_id
left join public.works w on w.id = p.work_id
left join public.audio_assets atr on atr.id = p.audio_tr_id
left join public.audio_assets aen on aen.id = p.audio_en_id;

grant select on public.nav_points_view to anon, authenticated;
