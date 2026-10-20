# Sezi yönetim paneli

Vite + React + TypeScript; Supabase (yalnızca anonim/publishable anahtar, yazma yetkisi RLS'te), TanStack Query, React Router, Mapbox GL. Arayüz shadcn/ui (radix, `components.json`) + Tailwind v4; tema mobil uygulamayla aynı "Çini 2" token'ları (`src/index.css`, [DESIGN.md](../../DESIGN.md)). Bileşen eklemek: `cd apps/admin && npx shadcn@latest add <ad>`.

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
| Pano | Açılış sayfası. İllere göre kapsam (kitaptaki eser sayısı, yayında, kesin konum, fotoğraflı, metinli), fotoğraf durumu, pilot alan ve tur kapsamı (fotoğraf / metin / kesin konum), sırada bekleyen işler. Sayılar her açılışta canlı tablolardan (`lib/dashboard.ts`); menüdeki bekleyen sayıları da buradan | – |
| Eserler | Arama; il, tür, durum, konum, fotoğraf, inceleme süzgeçleri (adres parametreleri: `?city=bursa&review=1` …) | – |
| Eser düzenleme | TR/EN alanlar, tür, ilçe, durum; haritada konum; fotoğraf onayı ve kapak | `verified` eser ve fotoğraflar uygulamada görünür (aşağı çekip yenileyince) |
| Yeni eser | Kimlik bilgileriyle taslak açar; benzer adlı eser uyarısı | Yayımlanınca görünür |
| Konum eşleştirme | Veri hattının konum adaylarını (Wikidata, OSM, önceki eşleşme) haritada ve gerekçeleriyle gösterir; tür/ilçe çelişkisi işaretli. Kabul et / reddet / hiçbiri; klavye J/K, 1–9, Enter | Kabul edilen aday eserin konumu olur (yapı düzeyi → kesin); seed yeniden çalışınca karar ezilmez |
| Eser metinleri | Kitaptan çıkarılan TR/EN adres ve tarihçe taslakları; kitap sayfasıyla karşılaştırıp düzeltme | "Esere yayınla" eserin adres/tarihçe/mimari alanına yazar; uygulamada eser sayfasında görünür |
| Fotoğraf kutusu | Kitapta eşleşmeyen arşiv fotoğraflarını klasör ipucuyla esere bağlar | "Bağla ve yayımla" ile eserin galerisine girer |
| Bildirimler | Erişilebilirlik bildirimlerini haritada gösterir; onay / ret | Onay `segment_overrides` tablosuna yazılır; uygulama rotada o yol parçasından kaçınır |
| İller | İl ekleme, yayına alma | Yalnızca yayındaki iller uygulamanın il seçicisinde |

Pilot alan grafiği mobil uygulamanın dosyasından okunur (`apps/mobile/assets/pilot/*-nav.json`), kopya tutulmaz.
