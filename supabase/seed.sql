-- Sınıflandırma verisi + pilot külliye iskeleti.
-- Eser metinleri burada YOK: tarihî içerik yalnızca kaynaklı veri setinden, data/ pipeline'ı ile gelir.

insert into regions (name) values
  ('{"tr":"Marmara","en":"Marmara"}'),
  ('{"tr":"Ege","en":"Aegean"}'),
  ('{"tr":"Akdeniz","en":"Mediterranean"}'),
  ('{"tr":"İç Anadolu","en":"Central Anatolia"}'),
  ('{"tr":"Karadeniz","en":"Black Sea"}'),
  ('{"tr":"Doğu Anadolu","en":"Eastern Anatolia"}'),
  ('{"tr":"Güneydoğu Anadolu","en":"Southeastern Anatolia"}');

insert into cities (region_id, name, center)
select id, '{"tr":"İstanbul","en":"Istanbul"}', 'SRID=4326;POINT(28.9784 41.0082)'
from regions where name ->> 'tr' = 'Marmara';

insert into work_types (slug, name) values
  ('cami',     '{"tr":"Cami","en":"Mosque"}'),
  ('medrese',  '{"tr":"Medrese","en":"Madrasa"}'),
  ('sebil',    '{"tr":"Sebil","en":"Sebil (water fountain)"}'),
  ('cesme',    '{"tr":"Çeşme","en":"Fountain"}'),
  ('han',      '{"tr":"Han","en":"Han (inn)"}'),
  ('hamam',    '{"tr":"Hamam","en":"Hammam"}'),
  ('imaret',   '{"tr":"İmaret","en":"Imaret (soup kitchen)"}'),
  ('turbe',    '{"tr":"Türbe","en":"Tomb"}'),
  ('kervansaray', '{"tr":"Kervansaray","en":"Caravanserai"}'),
  ('kopru',    '{"tr":"Köprü","en":"Bridge"}'),
  ('kutuphane','{"tr":"Kütüphane","en":"Library"}'),
  ('darussifa','{"tr":"Darüşşifa","en":"Hospital"}');

insert into complexes (slug, city_id, name, status)
select 'suleymaniye', id, '{"tr":"Süleymaniye Külliyesi","en":"Süleymaniye Complex"}', 'draft'
from cities where name ->> 'tr' = 'İstanbul';
