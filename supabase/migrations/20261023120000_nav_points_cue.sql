-- Duyu ipucu: yer işaretinin yanından geçerken yön bulmaya yardım edebilecek ses ya da koku.
-- water  çeşme/şadırvan: su akıyorsa sesi duyulabilir
-- bakery fırın/pastane: açıkken kokusu gelebilir
-- prayer cami/mescit: ezan okunurken ses bu yönden gelebilir
-- Bunlar olasılıktır, kesin bilgi değil: uygulama "olabilir" diye söyler, talimatı hiçbir zaman yalnız buna dayandırmaz.
-- OSM'den aday olarak taslak girer (data/build_sense_points.py); admin sahada bakıp yayınlar.
create type public.sense_cue as enum ('water', 'bakery', 'prayer');

alter table public.nav_points add column cue public.sense_cue;

-- create or replace yalnız sona sütun eklemeye izin verir: önceki sütunlar aynı sırada kalır.
create or replace view public.nav_points_view with (security_invoker = true) as
select
  p.id, p.city_id, c.slug as city_slug, p.roles, p.title, p.body, p.radius_m, p.source_note, p.status, p.updated_at,
  extensions.st_x(p.location::extensions.geometry) as lng,
  extensions.st_y(p.location::extensions.geometry) as lat,
  p.work_id, w.slug as work_slug, p.salience, p.ambient, p.field_checked, p.sort_order,
  p.audio_tr_id, atr.storage_path as audio_tr,
  p.audio_en_id, aen.storage_path as audio_en,
  p.cue
from public.nav_points p
join public.cities c on c.id = p.city_id
left join public.works w on w.id = p.work_id
left join public.audio_assets atr on atr.id = p.audio_tr_id
left join public.audio_assets aen on aen.id = p.audio_en_id;
