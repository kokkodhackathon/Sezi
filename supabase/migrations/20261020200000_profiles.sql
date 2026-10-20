-- Herkese açılabilen kimlik (ad, @kullanıcı adı, fotoğraf, renk) özel tercihlerden (`accounts.prefs`) ayrılır.
-- İleride arkadaş ekleme ve kişisel galeri bu tabloya bağlanır; şimdilik başkası yalnız `public` profili görür.
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  -- Küçük harf, rakam, alt çizgi; 3-20 karakter. Boş bırakılabilir; doluysa benzersiz.
  username text unique check (username ~ '^[a-z0-9_]{3,20}$'),
  -- Storage `avatars/<uid>/...`; yalnız kendi klasörü.
  avatar_path text check (avatar_path is null or avatar_path like user_id::text || '/%'),
  -- Fotoğraf yoksa baş harf dairesinin rengi (Çini 2 tonları).
  avatar_tone text not null default 'teal' check (avatar_tone in ('cobalt', 'teal', 'coral', 'saffron', 'sage', 'plum')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy read_own_or_public on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id or visibility = 'public');
create policy insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Silme politikası yok: satır hesapla birlikte (auth.users → cascade) silinir.

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

-- Mevcut adlar yeni tabloya taşınır; ad artık yalnız profilde.
insert into public.profiles (user_id, display_name) select user_id, display_name from public.accounts;
alter table public.accounts drop column display_name;

-- Profil fotoğrafları: özel kova; sahibi yazar ve okur, açık profilin fotoğrafını girişli kullanıcılar okur.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg']);

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy objects_read on storage.objects;
create policy objects_read on storage.objects for select to authenticated
  using (
    (bucket_id in ('media', 'audio') and (select public.is_admin()))
    or (bucket_id = 'reports' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())))
    or (
      bucket_id = 'avatars'
      and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or exists (select 1 from public.profiles p where p.user_id::text = (storage.foldername(name))[1] and p.visibility = 'public')
      )
    )
  );
