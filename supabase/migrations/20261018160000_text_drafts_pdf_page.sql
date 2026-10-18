-- Taslağın başladığı PDF sayfası (1'den başlar). Kitaplar çift sayfa yayılımı: basılı numara PDF dizinine eşit değil;
-- eşleme kitaba göre değiştiği için veri hattı hesaplar, admin "Kitapta aç" bağlantısı bunu kullanır.
alter table public.text_drafts add column pdf_page int check (pdf_page > 0);
