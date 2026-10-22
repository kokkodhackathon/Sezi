"""inventory_texts.py yazı tipine göre ayıklama kuralları. Çalıştırma: python -I data/test_inventory_texts.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import inventory_texts as it  # noqa: E402


class BodyText(unittest.TestCase):
    def test_kisa_italik_blok_metniyle_kalir_dili_belirsiz(self):
        text, lang, removed = it.body_text([[("italic", "“Lâ ilâhe illâllâh”")]], bursa=False)
        self.assertEqual(text, "“Lâ ilâhe illâllâh”")
        self.assertIsNone(lang)
        self.assertEqual(removed, 0)

    def test_karma_blokta_uzun_italik_alinti_cikarilir_dil_duz_yazidan(self):
        lines = [
            [("tr", "Kapının üstündeki kitabede şöyle yazar: "), ("italic", "“Bu mübarek mescidin inşasını Allah rızası")],
            [("italic", "için Hoca Ali yaptırdı”"), ("tr", " ve tarih düşülmüştür.")],
        ]
        text, lang, removed = it.body_text(lines, bursa=False)
        self.assertEqual(lang, "tr")
        self.assertEqual(removed, 1)
        self.assertIn("[…]", text)
        self.assertNotIn("Hoca Ali", text)
        self.assertTrue(text.endswith("ve tarih düşülmüştür."))

    def test_karma_blokta_kisa_italik_terim_korunur(self):
        lines = [[("tr", "Eser "), ("italic", "Usûl-i Mimâri-i Osmâni"), ("tr", " kitabında anılır.")]]
        text, lang, removed = it.body_text(lines, bursa=False)
        self.assertEqual((text, lang, removed), ("Eser Usûl-i Mimâri-i Osmâni kitabında anılır.", "tr", 0))

    def test_yalniz_uzun_italik_blok_bos_doner_ve_sayilir(self):
        text, lang, removed = it.body_text([[("italic", "“Bir iki üç dört beş altı yedi sekiz”")]], bursa=False)
        self.assertEqual((text, lang, removed), ("", None, 1))


class FillLangs(unittest.TestCase):
    def test_dili_belirsiz_blok_ayni_sayfadaki_onceki_govdenin_dilini_alir(self):
        stream = [(10, "body", "en", "English text.", 0), (10, "body", None, "“Kısa ayet”", 0), (10, "body", "tr", "Türkçe.", 0)]
        out, filled, dropped = it.fill_langs(stream)
        self.assertEqual(out[1][2], "en")
        self.assertEqual((filled, dropped), (1, 0))

    def test_once_gelen_yoksa_sonraki_govdeden_alir(self):
        stream = [(10, "head", None, "BAŞLIK", 0), (10, "body", None, "“Kısa”", 0), (10, "body", "tr", "Türkçe.", 0)]
        out, _, _ = it.fill_langs(stream)
        self.assertEqual(out[1][2], "tr")

    def test_sayfada_dilli_govde_yoksa_atilan_olarak_isaretlenir(self):
        stream = [(10, "body", "tr", "Önceki sayfa.", 0), (11, "body", None, "“Kısa”", 0)]
        out, filled, dropped = it.fill_langs(stream)
        self.assertEqual(out[1][1], "dropped")
        self.assertEqual((filled, dropped), (0, 1))


class Headings(unittest.TestCase):
    def test_buyuk_harf_baslik_turkce_okunur_bicim(self):
        self.assertEqual(it.heading_case("DEMİRTAŞ (TİMURTAŞ) CAMİİ VE ŞADIRVANI", "tr"), "Demirtaş (Timurtaş) Camii ve Şadırvanı")
        self.assertEqual(it.heading_case("I. MURAD HUDÂVENDİGÂR CAMİİ", "tr"), "I. Murad Hudâvendigâr Camii")

    def test_ingilizce_baslikta_noktali_i_birlesik_karakter_birakmaz(self):
        self.assertEqual(it.heading_case("TİMURTAŞ PAŞA BATH", "en"), "Timurtaş Paşa Bath")

    def test_ad_eslesmesi_ingilizce_kaymalari_yok_sayar(self):
        self.assertEqual(it.match_score("and Graveyard Meydancık Camii", "MEYDANCIK CAMİİ")[0], 1.0)

    def test_ceviri_paragrafi_kalibi(self):
        self.assertTrue(it.TRANSLATION_PARA.match("Mealen: “Bu yapı…”"))
        self.assertTrue(it.TRANSLATION_PARA.match("Translation: “This building…”"))
        self.assertFalse(it.TRANSLATION_PARA.match("Kitabede şu ifade yer alır: “…”"))


if __name__ == "__main__":
    unittest.main()
