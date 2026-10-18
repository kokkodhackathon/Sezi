-- Chirp 3 HD önbelleği: aynı metin bir kez üretilir (edge function `tts` yazar, herkes URL ile okur).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', true, 2097152, array['audio/mpeg'])
on conflict (id) do nothing;

-- Google'a giden yeni karakterlerin günlük toplamı (maliyet sınırı).
create table public.tts_usage (
  day date primary key,
  chars int not null default 0 check (chars >= 0),
  requests int not null default 0 check (requests >= 0)
);
alter table public.tts_usage enable row level security;
create policy admin_read on public.tts_usage for select to authenticated using ((select public.is_admin()));

-- Karakter ayırır; sınır aşılacaksa false (sayaç artmaz). Yalnız service_role çağırır.
create function public.tts_reserve(n int, cap int) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare used int;
begin
  if n <= 0 or n > cap then return false; end if;
  insert into public.tts_usage as u (day, chars, requests) values (current_date, n, 1)
  on conflict (day) do update set chars = u.chars + excluded.chars, requests = u.requests + 1
    where u.chars + excluded.chars <= cap
  returning u.chars into used;
  return used is not null;
end $$;
revoke execute on function public.tts_reserve(int, int) from public, anon, authenticated;
grant execute on function public.tts_reserve(int, int) to service_role;
