-- Sade özet önerisi: admin "Özet oluştur" deyince (edge function summarize, Gemini) ya da hazır öneri olarak yazılır.
-- Öneri yayına girmez: admin Eser metinleri sayfasında okur, kitapla karşılaştırır, "Özete taşı" der ve yayınlar.
-- summary sütunundan ayrı durur: edited_at koruması (text_drafts_mark_edited) ve yayın tetikleyicisi bu sütunlara bakmaz.
alter table public.text_drafts
  add column summary_suggestion jsonb check (summary_suggestion is null or public.is_localized(summary_suggestion)),
  add column summary_suggestion_by text check (summary_suggestion_by is null or length(trim(summary_suggestion_by)) > 0),
  add column summary_suggested_at timestamptz;
