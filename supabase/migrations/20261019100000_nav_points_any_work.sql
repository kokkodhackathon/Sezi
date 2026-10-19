-- Her rol bir esere bağlanabilir: yürüyüşte anlatım ya da yer işareti noktası açılınca o eserin
-- kısa bilgisi kartta görünür ve eser sayfasına geçilir. Varış bilgisi için eser hâlâ zorunlu.
alter table public.nav_points drop constraint nav_points_arrival_work;
alter table public.nav_points
  add constraint nav_points_arrival_work check (not ('arrival' = any(roles)) or work_id is not null);

-- Bir esere yayında tek varış bilgisi (anlatım/yer işareti noktaları aynı esere bağlanabilir).
drop index public.nav_points_arrival_unique;
create unique index nav_points_arrival_unique on public.nav_points (work_id)
  where status = 'verified' and 'arrival' = any(roles);
