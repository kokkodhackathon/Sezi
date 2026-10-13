# Sezi admin paneli

**Durum:** Vite + React + TypeScript şablonu; uygulama henüz yazılmadı. Kapsam ve kabul ölçütleri: [ROADMAP.md](../../ROADMAP.md) görev #2, #3, #9.

## Planlanan özellikler

1. **Giriş:** Supabase magic link. Yalnızca `app_metadata.role = 'admin'` olan kullanıcı yazabilir; RLS bunu zaten zorluyor.
2. **Eserler:**
   - Liste: il, ilçe, tür, durum, `needs_review` ve konum kesinliği filtreleri.
   - Düzenleme: TR/EN alanlar, kaynak bağlama, `draft → verified`.
3. **Konum:** Harita üzerinde iğne (MapLibre GL JS). `approximate` / `unknown` konumu `exact` yapar.
4. **Medya:** Fotoğraf yükleme (Storage, WebP ≤1600 px), TR/EN alt metin, telif bilgisi.
5. **Moderasyon:** Erişilebilirlik bildirimleri; onaylanınca ilgili segment güncellenir.

## Çalıştırma

```bash
cp ../../.env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
pnpm dev                     # http://localhost:5173
```
