-- İsteğe bağlı kullanıcı hesabı. Keşif ve rehberlik hesapsız çalışır; hesap tercihleri cihazlar arasında taşır
-- ve ileride yalnız hesaplılara açılacak özelliklerin sahibidir.
-- Satırı istemci ilk girişte kendisi ekler (RLS); auth.users üzerinde security definer tetikleyici yok.
create table public.accounts (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  -- Erişilebilirlik profili ve senkronlanan ayarlar (istemci Zod ile doğrular); 8 KB sınırı kötüye kullanımı keser.
  prefs jsonb check (prefs is null or (jsonb_typeof(prefs) = 'object' and octet_length(prefs::text) <= 8192)),
  -- Tercihin değiştiği an (istemci saati): cihazlar arası "en yeni kazanır" karşılaştırması bununla yapılır.
  prefs_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger accounts_updated before update on public.accounts for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;

create policy read_own on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy insert_own on public.accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy update_own on public.accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- Silme politikası yok: satır hesapla birlikte (auth.users → cascade) silinir.

revoke all on public.accounts from anon;
grant select, insert, update on public.accounts to authenticated;

-- Hesap silinince kullanıcının bildirimleri ve onay kayıtları kalır (topluluk verisi, rota onayları); yalnız bağ kopar.
alter table public.a11y_reports drop constraint a11y_reports_user_id_fkey;
alter table public.a11y_reports add constraint a11y_reports_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
alter table public.a11y_reports drop constraint a11y_reports_reviewed_by_fkey;
alter table public.a11y_reports add constraint a11y_reports_reviewed_by_fkey
  foreign key (reviewed_by) references auth.users(id) on delete set null;
