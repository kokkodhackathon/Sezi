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
| Pano | Açılış sayfası. Dört sayı (yayındaki, fotoğraflı, metinli, kesin konumlu eser; oran çubuğu ve kısa not); illere göre kitapta / yayında / fotoğraflı / metinli grafiği; bekleyen işler (inceleme bekleyen eserler dahil; tıklayınca ilgili sayfa); kapalı başlayan il tablosu (taslak, kesin / yaklaşık / konumsuz, toplam satırı); son 30 günün günlük ziyaret ve kayıt grafiği; kullanıcı sayıları; fotoğraf durumu (halka, fotoğraf kutusuna bağlantı); tur kapsamı. Grafikler shadcn charts. İçerik sayıları canlı tablolardan (`lib/dashboard.ts`), kullanıcı sayıları `admin-users` `stats` eyleminden; menüdeki bekleyen sayıları da buradan | – |
| Eserler | Arama; il, tür, durum, konum, fotoğraf, inceleme süzgeçleri (adres parametreleri: `?city=bursa&review=1` …) | – |
| Eser düzenleme | TR/EN alanlar, tür, ilçe, durum; haritada konum; fotoğraf onayı ve kapak | `verified` eser ve fotoğraflar uygulamada görünür (aşağı çekip yenileyince) |
| Yeni eser | Kimlik bilgileriyle taslak açar; benzer adlı eser uyarısı | Yayımlanınca görünür |
| Konum eşleştirme | Veri hattının konum adaylarını (Wikidata, OSM, önceki eşleşme) haritada ve gerekçeleriyle gösterir; tür/ilçe çelişkisi işaretli. Kabul et / reddet / hiçbiri; klavye J/K, 1–9, Enter | Kabul edilen aday eserin konumu olur (yapı düzeyi → kesin); seed yeniden çalışınca karar ezilmez |
| Eser metinleri | Kitaptan çıkarılan TR/EN adres ve tarihçe taslakları; kitap sayfasıyla karşılaştırıp düzeltme | "Esere yayınla" eserin adres/tarihçe/mimari alanına yazar; uygulamada eser sayfasında görünür |
| Fotoğraf kutusu | Kitapta eşleşmeyen arşiv fotoğraflarını klasör ipucuyla esere bağlar | "Bağla ve yayımla" ile eserin galerisine girer |
| Bildirimler | Erişilebilirlik bildirimlerini haritada gösterir; onay / ret | Onay `segment_overrides` tablosuna yazılır; uygulama rotada o yol parçasından kaçınır |
| Kullanıcılar | Hesap listesi (ad, @kullanıcı adı, e-posta, kayıt, son giriş, ziyaret/fotoğraf/bildirim sayıları); yönetici yap / kaldır, askıya al / kaldır, hesabı sil (onaylı); satıra tıklayınca katkılar ve son ziyaretler. Kendi hesabınıza işlem yapılamaz | Edge function `admin-users` üzerinden; rol değişikliği kişinin bir sonraki oturum yenilemesinde geçer, askıdaki hesap giriş yapamaz |
| İller | İl ekleme, yayına alma | Yalnızca yayındaki iller uygulamanın il seçicisinde |

1280 px altında sol menü çekmeceye geçer (üstteki menü düğmesi); sayfa hiçbir genişlikte yana kaymaz, geniş tablolar kendi çerçevesinde kayar.

Pilot alan grafiği mobil uygulamanın dosyasından okunur (`apps/mobile/assets/pilot/*-nav.json`), kopya tutulmaz.
