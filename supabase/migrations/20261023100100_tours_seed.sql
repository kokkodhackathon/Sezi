-- Başlangıç turları (Bursa pilot alanı). Açıklamalar yalnız durakları sayar; tarihî bilgi içermez (kural 3).
-- Sıra uygulamada hesaplanır (fixed_order = false); mesafeler gerçek yol ağında ~0,6–0,85 km.
insert into public.tours (slug, city_id, title, body, stops, sort_order, status)
select v.slug, c.id, v.title::jsonb, v.body::jsonb, v.stops::text[], v.sort_order, 'verified'
from public.cities c
cross join (values
  ('carsinin-kalbi',
   '{"tr":"Çarşının kalbi","en":"Heart of the bazaar"}',
   '{"tr":"Ulucami, çevresindeki hanlar, Bedesten ve Orhan Bey Camii.","en":"The Grand Mosque, the inns around it, the Bedesten and Orhan Bey Mosque."}',
   '{bursa-ulucami,bursa-emir-hani,bursa-geyve-hani,bursa-yildirim-bayezid-bedesteni,bursa-koza-hani,bursa-koza-han-mescidi,bursa-orhan-bey-camii}',
   1),
  ('hanlar-yolu',
   '{"tr":"Hanlar yolu","en":"The inns route"}',
   '{"tr":"Pirinç Hanı''ndan Fidan Hanı''na altı han.","en":"Six inns, from Pirinç Han to Fidan Han."}',
   '{bursa-pirinc-hani,bursa-ipek-hani,bursa-emir-hani,bursa-geyve-hani,bursa-koza-hani,bursa-fidan-hani}',
   2),
  ('tophane-turbeleri',
   '{"tr":"Tophane türbeleri","en":"Tophane tombs"}',
   '{"tr":"Haraççıoğlu Medresesi, Okçu Baba, Osman Gazi ve Orhan Gazi türbeleri.","en":"Haraççıoğlu Madrasa and the tombs of Okçu Baba, Osman Gazi and Orhan Gazi."}',
   '{bursa-haraccioglu-medresesi,bursa-okcu-baba-turbesi,bursa-osman-gazi-turbesi,bursa-orhan-gazi-turbesi}',
   3),
  ('mahalle-camileri',
   '{"tr":"Sakin mahalle camileri","en":"Quiet neighbourhood mosques"}',
   '{"tr":"Ulucami''den Şeker Hoca, Arap Mehmet ve Veled-i Habib camilerine.","en":"From the Grand Mosque to the Şeker Hoca, Arap Mehmet and Veled-i Habib mosques."}',
   '{bursa-ulucami,bursa-seker-hoca-camii,bursa-arap-mehmet-camii,bursa-veled-i-habib-camii}',
   4),
  ('kuzey-mahalleleri',
   '{"tr":"Kuzey mahalleleri","en":"Northern neighbourhoods"}',
   '{"tr":"Fidan Hanı''ndan Elmalık ve Acemler camilerine, Bekir Dede Türbesi''ne.","en":"From Fidan Han to the Elmalık and Acemler mosques and Bekir Dede Tomb."}',
   '{bursa-fidan-hani,bursa-elmalik-camii,bursa-acemler-camii,bursa-bekir-dede-turbesi}',
   5)
) as v(slug, title, body, stops, sort_order)
where c.slug = 'bursa';
