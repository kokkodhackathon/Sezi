-- Profil, karşılıklı arkadaşlık, pasaport ve fotoğraf arşivi. Bütün değişiklikler birlikte uygulanır.
begin;

alter table public.profiles drop constraint if exists profiles_visibility_check;
alter table public.profiles add constraint profiles_visibility_check check (visibility in ('private', 'friends', 'public'));
alter table public.profiles add column if not exists findable boolean not null default false;
alter table public.profiles add column if not exists photo_default text not null default 'private' check (photo_default in ('private', 'friends', 'public'));
revoke update on public.profiles from authenticated;
grant update (display_name, username, avatar_path, avatar_tone, visibility, findable, photo_default) on public.profiles to authenticated;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee_idx on public.friendships (addressee);
create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked);
alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
revoke all on public.friendships, public.blocks from anon, authenticated;
grant select, insert, update, delete on public.friendships to authenticated;
grant select, insert, delete on public.blocks to authenticated;
drop policy if exists read_participant on public.friendships;
create policy read_participant on public.friendships for select to authenticated using ((select auth.uid()) in (requester, addressee));
drop policy if exists insert_own on public.friendships;
create policy insert_own on public.friendships for insert to authenticated with check (requester = (select auth.uid()));
drop policy if exists accept_incoming on public.friendships;
create policy accept_incoming on public.friendships for update to authenticated using (addressee = (select auth.uid())) with check (addressee = (select auth.uid()));
drop policy if exists delete_participant on public.friendships;
create policy delete_participant on public.friendships for delete to authenticated using ((select auth.uid()) in (requester, addressee));
drop policy if exists read_participant on public.blocks;
create policy read_participant on public.blocks for select to authenticated using ((select auth.uid()) in (blocker, blocked));
drop policy if exists insert_own on public.blocks;
create policy insert_own on public.blocks for insert to authenticated with check (blocker = (select auth.uid()));
drop policy if exists delete_own on public.blocks;
create policy delete_own on public.blocks for delete to authenticated using (blocker = (select auth.uid()));

create or replace function public.friendships_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.requester := auth.uid();
    new.status := 'pending';
    new.responded_at := null;
    if exists (select 1 from public.blocks b where (b.blocker = new.requester and b.blocked = new.addressee) or (b.blocker = new.addressee and b.blocked = new.requester))
      or not exists (select 1 from public.profiles p where p.user_id = new.addressee and (p.findable or p.visibility = 'public')) then
      raise exception 'Bu kişiye istek gönderilemez';
    end if;
    if (select count(*) from public.friendships f where f.requester = new.requester and f.created_at > now() - interval '1 hour') >= 20 then
      raise exception 'Çok fazla istek gönderildi; biraz sonra tekrar deneyin';
    end if;
  else
    if old.status <> 'pending' or new.status <> 'accepted' then
      raise exception 'Yalnız bekleyen istek kabul edilebilir';
    end if;
    new.requester := old.requester;
    new.addressee := old.addressee;
    new.created_at := old.created_at;
    new.responded_at := now();
  end if;
  return new;
end $$;
drop trigger if exists friendships_guard on public.friendships;
create trigger friendships_guard before insert or update on public.friendships for each row execute function public.friendships_guard();
create or replace function public.blocks_after_insert() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.friendships f where (f.requester = new.blocker and f.addressee = new.blocked) or (f.requester = new.blocked and f.addressee = new.blocker);
  return new;
end $$;
drop trigger if exists blocks_after_insert on public.blocks;
create trigger blocks_after_insert after insert on public.blocks for each row execute function public.blocks_after_insert();

create or replace function public.is_friend(other uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.friendships f where f.status = 'accepted' and ((f.requester = (select auth.uid()) and f.addressee = other) or (f.addressee = (select auth.uid()) and f.requester = other)))
$$;
create or replace function public.can_view_profile(owner uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select owner = (select auth.uid()) or public.is_admin() or exists (select 1 from public.profiles p where p.user_id = owner and (p.visibility = 'public' or (p.visibility = 'friends' and public.is_friend(owner))))
$$;
drop policy if exists read_own_or_public on public.profiles;
drop policy if exists read_visible on public.profiles;
create policy read_visible on public.profiles for select to authenticated using (
  (select auth.uid()) = user_id or (select public.is_admin()) or (
    (visibility = 'public' or findable or exists (select 1 from public.friendships f where (f.requester = (select auth.uid()) and f.addressee = profiles.user_id) or (f.addressee = (select auth.uid()) and f.requester = profiles.user_id)))
    and not exists (select 1 from public.blocks b where b.blocker = profiles.user_id and b.blocked = (select auth.uid()))
  )
);
drop policy if exists objects_read on storage.objects;
create policy objects_read on storage.objects for select to authenticated
  using (
    (bucket_id in ('media', 'audio') and (select public.is_admin()))
    or (bucket_id = 'reports' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())))
    or (
      bucket_id = 'avatars'
      and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or exists (select 1 from public.profiles p where p.user_id::text = (storage.foldername(name))[1])
      )
    )
  );

create table if not exists public.visits (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  work_slug text not null references public.works(slug) on update cascade on delete cascade,
  first_at timestamptz not null,
  method text not null check (method in ('route', 'checkin')),
  distance_m int check (distance_m is null or distance_m between 0 and 20000),
  created_at timestamptz not null default now(),
  primary key (user_id, work_slug)
);
create index if not exists visits_work_slug_idx on public.visits (work_slug);
alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;
grant select, insert, delete on public.visits to authenticated;
drop policy if exists read_visible on public.visits;
create policy read_visible on public.visits for select to authenticated using ((select public.can_view_profile(user_id)));
drop policy if exists insert_own on public.visits;
create policy insert_own on public.visits for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.works w where w.slug = work_slug and w.status = 'verified'));
drop policy if exists delete_own on public.visits;
create policy delete_own on public.visits for delete to authenticated using (user_id = (select auth.uid()));
create or replace function public.visits_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.first_at < now() - interval '400 days' or new.first_at > now() + interval '10 minutes' then new.first_at := now(); end if;
  if new.method = 'checkin' then new.distance_m := null; end if;
  if (select count(*) from public.visits v where v.user_id = auth.uid() and v.created_at > now() - interval '1 hour') >= 200 then raise exception 'Çok fazla ziyaret kaydı'; end if;
  return new;
end $$;
drop trigger if exists visits_guard on public.visits;
create trigger visits_guard before insert on public.visits for each row execute function public.visits_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('user-photos', 'user-photos', false, 5242880, array['image/jpeg']) on conflict (id) do nothing;
create table if not exists public.user_photos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  work_slug text not null references public.works(slug) on update cascade on delete cascade,
  path text not null check (path like user_id::text || '/%'),
  thumb_path text not null check (thumb_path like user_id::text || '/%'),
  width int not null,
  height int not null,
  alt_text text not null check (char_length(btrim(alt_text)) between 1 and 300),
  caption text check (caption is null or char_length(caption) <= 280),
  taken_at date,
  visibility text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  review text not null default 'none' check (review in ('none', 'pending', 'approved', 'rejected')),
  archive text not null default 'none' check (archive in ('none', 'suggested', 'accepted', 'declined')),
  credit_name text,
  media_id uuid references public.media(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_photos_user_created_idx on public.user_photos (user_id, created_at desc);
create index if not exists user_photos_public_work_idx on public.user_photos (work_slug) where visibility = 'public' and review = 'approved';
create index if not exists user_photos_pending_idx on public.user_photos (review) where review = 'pending';
create index if not exists user_photos_suggested_idx on public.user_photos (archive) where archive = 'suggested';
alter table public.user_photos enable row level security;
revoke all on public.user_photos from anon, authenticated;
grant select on public.user_photos to anon;
grant select, insert, update, delete on public.user_photos to authenticated;
drop policy if exists public_approved on public.user_photos;
create policy public_approved on public.user_photos for select to anon using (visibility = 'public' and review = 'approved');
drop policy if exists read_visible on public.user_photos;
create policy read_visible on public.user_photos for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()) or (visibility = 'public' and review = 'approved') or (visibility in ('friends', 'public') and (select public.is_friend(user_id))));
drop policy if exists insert_own on public.user_photos;
create policy insert_own on public.user_photos for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists update_own_or_admin on public.user_photos;
create policy update_own_or_admin on public.user_photos for update to authenticated using (user_id = (select auth.uid()) or (select public.is_admin())) with check (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists delete_own on public.user_photos;
create policy delete_own on public.user_photos for delete to authenticated using (user_id = (select auth.uid()));
create or replace function public.user_photos_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  -- Moderasyon dalı: admin başkasının satırını ya da kendi satırının yalnız moderasyon
  -- sütunlarını değiştiriyorsa. Ekip üyesi kendi fotoğrafını da onaylayabilir.
  if tg_op = 'UPDATE' and public.is_admin() and (
    old.user_id <> auth.uid()
    or new.review is distinct from old.review
    or new.media_id is distinct from old.media_id
    or (new.archive is distinct from old.archive and new.archive in ('accepted', 'declined'))
  ) then
    new.user_id := old.user_id; new.work_slug := old.work_slug;
    new.path := old.path; new.thumb_path := old.thumb_path;
    new.width := old.width; new.height := old.height;
    new.alt_text := old.alt_text; new.caption := old.caption;
    new.taken_at := old.taken_at; new.visibility := old.visibility;
    if new.review is distinct from old.review then new.reviewed_at := now(); end if;
    if new.review = 'approved' and new.credit_name is null then
      new.credit_name := (select p.display_name from public.profiles p where p.user_id = new.user_id);
    end if;
  elsif tg_op = 'INSERT' then
    new.review := case when new.visibility = 'public' then 'pending' else 'none' end;
    if new.archive not in ('none', 'suggested') then raise exception 'Geçersiz arşiv durumu'; end if;
    new.credit_name := null; new.media_id := null; new.reviewed_at := null;
    if (select count(*) from public.user_photos p where p.user_id = auth.uid()) >= 300 then raise exception 'Fotoğraf sınırına ulaşıldı (300)'; end if;
    if (select count(*) from public.user_photos p where p.user_id = auth.uid() and p.created_at > now() - interval '1 hour') >= 30 then raise exception 'Çok fazla fotoğraf yüklendi; biraz sonra tekrar deneyin'; end if;
  else
    new.user_id := old.user_id; new.work_slug := old.work_slug;
    new.path := old.path; new.thumb_path := old.thumb_path;
    new.width := old.width; new.height := old.height;
    new.review := old.review; new.credit_name := old.credit_name;
    new.media_id := old.media_id; new.reviewed_at := old.reviewed_at;
    if new.visibility is distinct from old.visibility then
      if new.visibility = 'public' then new.review := 'pending'; new.credit_name := null;
      else new.review := 'none'; end if;
    end if;
    if new.visibility = 'public' and new.review = 'approved' and (new.alt_text is distinct from old.alt_text or new.caption is distinct from old.caption) then new.review := 'pending'; end if;
    if old.archive = 'accepted' and new.archive is distinct from old.archive then raise exception 'Arşive alınan fotoğrafın izni geri çekilemez'; end if;
    if new.archive not in ('none', 'suggested') and new.archive is distinct from old.archive then raise exception 'Geçersiz arşiv durumu'; end if;
  end if;
  return new;
end $$;
drop trigger if exists user_photos_guard on public.user_photos;
create trigger user_photos_guard before insert or update on public.user_photos for each row execute function public.user_photos_guard();
drop trigger if exists user_photos_updated on public.user_photos;
create trigger user_photos_updated before update on public.user_photos for each row execute function public.set_updated_at();
drop policy if exists user_photos_read on storage.objects;
create policy user_photos_read on storage.objects for select to anon, authenticated using (bucket_id = 'user-photos' and exists (select 1 from public.user_photos p where storage.objects.name in (p.path, p.thumb_path)));
drop policy if exists user_photos_insert_own on storage.objects;
create policy user_photos_insert_own on storage.objects for insert to authenticated with check (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists user_photos_delete_own on storage.objects;
create policy user_photos_delete_own on storage.objects for delete to authenticated using (bucket_id = 'user-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter table public.media drop constraint if exists media_origin_check;
alter table public.media add constraint media_origin_check check (origin in ('inventory', 'commons', 'upload', 'community'));
alter table public.media drop constraint if exists media_community_attribution;
alter table public.media add constraint media_community_attribution check (origin <> 'community' or (nullif(btrim(author), '') is not null and nullif(btrim(license), '') is not null));

create table if not exists public.contributions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reports_approved int not null default 0,
  photos_public int not null default 0,
  photos_archived int not null default 0,
  friends int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.contributions enable row level security;
revoke all on public.contributions from anon, authenticated;
grant select on public.contributions to authenticated;
drop policy if exists read_visible on public.contributions;
create policy read_visible on public.contributions for select to authenticated using ((select public.can_view_profile(user_id)));
create or replace function public.refresh_contributions(uid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if uid is null then return; end if;
  -- Hesap silinirken diğer cascade tetikleyicileri artık olmayan kullanıcıya sayaç açmamalı.
  if not exists (select 1 from auth.users u where u.id = uid) then return; end if;
  insert into public.contributions (user_id, reports_approved, photos_public, photos_archived, friends, updated_at)
  values (
    uid,
    (select count(*) from public.a11y_reports r where r.user_id = uid and r.status = 'approved'),
    (select count(*) from public.user_photos p where p.user_id = uid and p.visibility = 'public' and p.review = 'approved'),
    (select count(*) from public.user_photos p where p.user_id = uid and p.archive = 'accepted'),
    (select count(*) from public.friendships f where f.status = 'accepted' and uid in (f.requester, f.addressee)),
    now()
  ) on conflict (user_id) do update set reports_approved = excluded.reports_approved, photos_public = excluded.photos_public, photos_archived = excluded.photos_archived, friends = excluded.friends, updated_at = excluded.updated_at;
end $$;
create or replace function public.contrib_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.refresh_contributions(new.user_id); return new; end $$;
create or replace function public.contrib_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.refresh_contributions(coalesce(new.user_id, old.user_id)); return coalesce(new, old); end $$;
create or replace function public.contrib_friendships() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_contributions(coalesce(new.requester, old.requester));
  perform public.refresh_contributions(coalesce(new.addressee, old.addressee));
  return coalesce(new, old);
end $$;
create or replace function public.contrib_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin perform public.refresh_contributions(new.user_id); return new; end $$;
revoke execute on function public.refresh_contributions(uuid), public.contrib_reports(), public.contrib_photos(), public.contrib_friendships(), public.contrib_profiles() from public, anon, authenticated;
-- Tetikleyiciler RPC değildir; invoker olanlar da doğrudan çalıştırılamaz.
revoke execute on function public.friendships_guard(), public.blocks_after_insert(), public.visits_guard(), public.user_photos_guard() from public, anon, authenticated;
drop trigger if exists contrib_reports on public.a11y_reports;
create trigger contrib_reports after update of status on public.a11y_reports for each row execute function public.contrib_reports();
drop trigger if exists contrib_photos on public.user_photos;
create trigger contrib_photos after insert or update or delete on public.user_photos for each row execute function public.contrib_photos();
drop trigger if exists contrib_friendships on public.friendships;
create trigger contrib_friendships after insert or update or delete on public.friendships for each row execute function public.contrib_friendships();
drop trigger if exists contrib_profiles on public.profiles;
create trigger contrib_profiles after insert on public.profiles for each row execute function public.contrib_profiles();
select public.refresh_contributions(user_id) from public.profiles;

commit;
