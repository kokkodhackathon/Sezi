-- Metin taslakları: elle düzenleme koruması ve kitaptaki başlık.
--  * edited_at: bir admin taslağın metin alanlarını değiştirince sunucuda yazılır. Veri hattı (seed, auth.uid() yok)
--    yalnız edited_at boş olan bekleyen taslakları günceller/siler; elle düzenlenmiş taslak yeniden üretimde ezilmez.
--  * book_title: eserin kitaptaki başlığı {tr, en} (yazı tipinden okunur). Uygulamadaki ad bundan farklıysa admin
--    panelinde düzeltme önerisi olarak gösterilir; ad kendiliğinden değişmez.

alter table public.text_drafts
  add column edited_at timestamptz,
  add column book_title jsonb;

create function public.text_drafts_mark_edited() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null
     and (new.address, new.history, new.architecture, new.built_year, new.founder, new.period, new.summary)
         is distinct from (old.address, old.history, old.architecture, old.built_year, old.founder, old.period, old.summary) then
    new.edited_at := now();
  end if;
  return new;
end $$;
revoke execute on function public.text_drafts_mark_edited() from public, anon, authenticated;

create trigger text_drafts_mark_edited before update on public.text_drafts
  for each row execute function public.text_drafts_mark_edited();
