-- Eşleştirme kararları tek işlemde: istemci yalnız karar satırını günceller, eserdeki değişikliği tetikleyici
-- aynı transaction içinde yapar. Eser güncellemesi başarısız olursa karar da yazılmaz (ara durum kalmaz).
-- Fonksiyonlar security invoker: RLS geçerli, yalnız admin hem karar satırını hem eseri yazabilir.

-- Bir eserin en çok bir kabul edilmiş konum adayı olur.
create unique index location_candidates_one_accepted on public.location_candidates (work_id) where status = 'accepted';

-- Aday kabul edilince: aynı eserin diğer bekleyen/kabul edilmiş adayları reddedilir; eserin konumu, kesinliği
-- (yapı düzeyi → exact) ve dış kimlikleri adaydan yazılır. Kimlikler: eserin diğer adaylarına ait (yanlış eşleşmiş)
-- kimlikler silinir; kabul edilen aday ve onunla 100 m içinde uyuşan vetosuz adaylar yazılır.
create function public.apply_candidate_decision() returns trigger
language plpgsql set search_path = '' as $$
declare
  ids jsonb;
  s record;
  k text;
begin
  if new.status is not distinct from old.status or new.status <> 'accepted' then
    return new;
  end if;

  -- Önce: tekil kabul dizini yeni satır yazılmadan önce boşalsın.
  update public.location_candidates set status = 'rejected'
  where work_id = new.work_id and id <> new.id and status in ('pending', 'accepted');

  select coalesce(external_ids, '{}'::jsonb) into ids from public.works where id = new.work_id;
  for s in select ref from public.location_candidates where work_id = new.work_id and id <> new.id loop
    if ids ->> 'wikidata' = s.ref then ids := ids - 'wikidata'; end if;
    if ids ->> 'osm' = s.ref then ids := ids - 'osm'; end if;
  end loop;
  for s in
    select ref from public.location_candidates c
    where c.work_id = new.work_id and (c.id = new.id or (not c.vetoed and extensions.st_distance(
      extensions.st_setsrid(extensions.st_makepoint(c.lng, c.lat), 4326)::extensions.geography,
      extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography) <= 100))
    order by (c.id = new.id), c.score
  loop
    k := case when s.ref ~ '^Q\d+$' then 'wikidata' when s.ref ~ '^(node|way|relation)/\d+$' then 'osm' end;
    if k is not null then ids := ids || jsonb_build_object(k, s.ref); end if;
  end loop;

  update public.works set
    location = extensions.st_setsrid(extensions.st_makepoint(new.lng, new.lat), 4326)::extensions.geography,
    location_precision = (case when new.level = 'building' then 'exact' else 'approximate' end)::public.location_precision,
    external_ids = ids
  where id = new.work_id;
  if not found then
    raise exception 'eser güncellenemedi (yetki ya da eser yok): %', new.work_id;
  end if;
  return new;
end $$;
revoke execute on function public.apply_candidate_decision() from public, anon, authenticated;

create trigger location_candidates_apply before update of status on public.location_candidates
  for each row execute function public.apply_candidate_decision();

-- Taslak yayınlanınca: (admin'in düzenlediği) adres, tarihçe ve mimari metni aynı işlemde esere yazılır.
create function public.apply_text_publish() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is not distinct from old.status or new.status <> 'published' then
    return new;
  end if;
  if new.address is null and new.history is null and new.architecture is null then
    raise exception 'yayınlanacak metin yok';
  end if;
  update public.works set address = new.address, history = new.history, architecture = new.architecture
  where id = new.work_id;
  if not found then
    raise exception 'eser güncellenemedi (yetki ya da eser yok): %', new.work_id;
  end if;
  return new;
end $$;
revoke execute on function public.apply_text_publish() from public, anon, authenticated;

create trigger text_drafts_apply before update of status on public.text_drafts
  for each row execute function public.apply_text_publish();
