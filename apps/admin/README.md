# Sezi yönetim paneli

Vite + React + TypeScript; Supabase (yalnızca anonim/publishable anahtar, yazma yetkisi RLS'te), TanStack Query, React Router, MapLibre GL. Görsel dil mobil uygulamayla aynı "Çini" token'ları ([DESIGN.md](../../DESIGN.md)).

## Çalıştırma

```bash
# apps/admin/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (mobil .env ile aynı değerler)
pnpm --filter @sezi/admin dev     # http://localhost:3000
```

Port 3000, Supabase Auth'un varsayılan "Site URL" adresi: e-postadaki giriş bağlantısı ek ayar olmadan buraya döner.

## Yönetici yapmak

Kullanıcı panelden bir kez giriş yapar, sonra (Supabase MCP ya da SQL Editor):

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}' where email = '<e-posta>';
```

Kullanıcı çıkış yapıp yeniden girince rol oturuma yazılır.

## Sayfalar

| Sayfa | Ne yapar | Uygulamaya etkisi |
|---|---|---|
| Eserler | Arama; il, tür, durum, konum, fotoğraf, inceleme süzgeçleri | – |
| Eser düzenleme | TR/EN alanlar, tür, ilçe, durum; haritada konum; fotoğraf onayı ve kapak | `verified` eser ve fotoğraflar uygulamada görünür (aşağı çekip yenileyince) |
| Yeni eser | Kimlik bilgileriyle taslak açar; benzer adlı eser uyarısı | Yayımlanınca görünür |
| Fotoğraf kutusu | Kitapta eşleşmeyen arşiv fotoğraflarını klasör ipucuyla esere bağlar | "Bağla ve yayımla" ile eserin galerisine girer |
| Bildirimler | Erişilebilirlik bildirimlerini haritada gösterir; onay / ret | Onay `segment_overrides` tablosuna yazılır; uygulama rotada o yol parçasından kaçınır |
| İller | İl ekleme, yayına alma | Yalnızca yayındaki iller uygulamanın il seçicisinde |

Pilot alan grafiği mobil uygulamanın dosyasından okunur (`apps/mobile/assets/pilot/*-nav.json`), kopya tutulmaz.
