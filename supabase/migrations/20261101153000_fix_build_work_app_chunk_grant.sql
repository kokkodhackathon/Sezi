-- Admin konum adayı onayladığında ya da eser kaydını güncellediğinde works_zz_sync_app_chunk
-- tetikleyicisi SECURITY INVOKER (authenticated rolü) olarak çalışır ve public.build_work_app_chunk(uuid, text)
-- yardımcı fonksiyonunu çağırır. Bu fonksiyon trigger olmadığı için PostgreSQL çalıştırma izni (EXECUTE) arar.
-- anon ve public kapalı tutulup authenticated ve service_role rollerine çalıştırma izni verilir.

do $$
begin
  if to_regprocedure('public.build_work_app_chunk(uuid,text)') is not null then
    revoke execute on function public.build_work_app_chunk(uuid, text) from public, anon;
    grant execute on function public.build_work_app_chunk(uuid, text) to authenticated, service_role;
  end if;
end $$;
