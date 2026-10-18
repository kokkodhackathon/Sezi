import type { LocalizedText } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';

import type { Precision, Status } from './data';
import { supabase } from './supabase';

/**
 * Eşleştirme masası: veri hattının önerileri (data/location_candidates.py, data/inventory_texts.py).
 * Admin karar verince eserin kendisine (`works`) yazılır; uygulama yalnız `works` okur.
 */

export type CandidateSource = 'wikidata' | 'osm' | 'nominatim' | 'override' | 'current';
export type CandidateLevel = 'building' | 'street' | 'neighbourhood' | 'village' | 'district';
export type Decision = 'pending' | 'accepted' | 'rejected';

export interface CandidateReasons {
  name?: number;
  type?: { work?: string | null; candidate?: string | null; ok?: boolean | null };
  district?: { name?: string | null; inside?: boolean | null } | null;
  agree?: string[];
  current?: boolean;
  curated?: boolean;
  unverified?: boolean;
  note?: string;
  [key: string]: unknown;
}

export interface Candidate {
  id: string;
  work_id: string;
  source: CandidateSource;
  ref: string;
  label: string | null;
  kind: string | null;
  lng: number;
  lat: number;
  level: CandidateLevel;
  score: number;
  reasons: CandidateReasons;
  vetoed: boolean;
  status: Decision;
  decided_at: string | null;
}

export interface QueueWork {
  id: string;
  slug: string;
  name: LocalizedText;
  type_slug: string;
  district: string | null;
  status: Status;
  location_precision: Precision;
  lng: number | null;
  lat: number | null;
}

export const SOURCE_LABEL: Record<CandidateSource, string> = {
  wikidata: 'Wikidata',
  osm: 'OpenStreetMap',
  nominatim: 'Nominatim',
  override: 'Elle düzeltme',
  current: 'Önceki eşleşme',
};

export const LEVEL_LABEL: Record<CandidateLevel, string> = {
  building: 'Yapı',
  street: 'Sokak',
  neighbourhood: 'Mahalle',
  village: 'Köy',
  district: 'İlçe',
};

/** Kaynak renkleri (haritada her zaman numara ve ad etiketiyle birlikte; renk tek başına anlam taşımaz). */
export const SOURCE_COLOR: Record<CandidateSource, string> = {
  wikidata: '#0B6E73',
  osm: '#3A6B2E',
  nominatim: '#B07A12',
  override: '#3A2A1E',
  current: '#8A7F76',
};

/** Kaynaktaki kaydın adresi (kontrol için yeni sekmede açılır). */
export function sourceUrl(c: Pick<Candidate, 'source' | 'ref'>): string | null {
  if (/^Q\d+$/.test(c.ref)) return `https://www.wikidata.org/wiki/${c.ref}`;
  if (/^(node|way|relation)\/\d+$/.test(c.ref)) return `https://www.openstreetmap.org/${c.ref}`;
  return null;
}

/** Çok satırlı sorgu: PostgREST tek yanıtta en çok 1000 satır döner. */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/** Bir ilin eserleri ve konum adayları. */
export function useMatchQueue(citySlug: string) {
  return useQuery({
    queryKey: ['match-queue', citySlug],
    queryFn: async () => {
      const works = await fetchAll<QueueWork>((a, b) =>
        supabase
          .from('works_view')
          .select('id, slug, name, type_slug, district, status, location_precision, lng, lat')
          .eq('city_slug', citySlug)
          .neq('status', 'archived')
          .order('slug')
          .range(a, b),
      );
      const candidates = await fetchAll<Candidate & { works: unknown }>((a, b) =>
        supabase
          .from('location_candidates')
          .select('id, work_id, source, ref, label, kind, lng, lat, level, score, reasons, vetoed, status, decided_at, works!inner(cities!inner(slug))')
          .eq('works.cities.slug', citySlug)
          .order('id')
          .range(a, b),
      );
      const byWork = new Map<string, Candidate[]>();
      for (const { works: _join, ...c } of candidates) {
        const list = byWork.get(c.work_id) ?? [];
        list.push(c);
        byWork.set(c.work_id, list);
      }
      for (const list of byWork.values()) list.sort(rankCandidates);
      return { works, byWork };
    },
  });
}

/** Sıra: kararlı aday önce, sonra vetosuzlar puana göre, vetolular en sonda. */
export function rankCandidates(a: Candidate, b: Candidate): number {
  const w = (c: Candidate) => (c.status === 'accepted' ? 2 : 0) + (c.vetoed ? -1 : 0);
  return w(b) - w(a) || b.score - a.score;
}

export type QueueState = 'pending' | 'conflict' | 'decided' | 'none';

/** Kuyruktaki durum: karar verildi mi, iyi bir aday var mı, adaylar çelişiyor mu. */
export function queueState(list: Candidate[] | undefined): QueueState {
  if (!list || list.length === 0) return 'none';
  if (list.some((c) => c.status === 'accepted')) return 'decided';
  const open = list.filter((c) => c.status === 'pending' && !c.vetoed);
  if (open.length === 0) return list.some((c) => c.status === 'pending') ? 'conflict' : 'decided';
  // Vetosuz iki aday birbirinden 150 m'den uzaksa kaynaklar çelişiyor.
  const far = open.some((a) => open.some((b) => distanceM([a.lng, a.lat], [b.lng, b.lat]) > 150));
  return far ? 'conflict' : 'pending';
}

export const STATE_LABEL: Record<QueueState, string> = {
  pending: 'Bekliyor',
  conflict: 'Çelişkili',
  decided: 'Karar verildi',
  none: 'Aday yok',
};

export function distanceM(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Güncelleme bir satıra dokunmadıysa (RLS gizledi ya da satır yok) hata: sessiz başarısızlık olmasın. */
async function expectOne(q: PromiseLike<{ data: unknown; error: unknown }>): Promise<void> {
  const { data, error } = await q;
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) throw new Error('Kayıt güncellenemedi (yetki ya da kayıt yok).');
}

/**
 * Adayı kabul eder. Tek istek: eserin konumu, kesinliği (yapı düzeyi → kesin) ve dış kimlikleri, aynı eserin diğer
 * adaylarının reddi aynı işlemde veritabanı tetikleyicisinde yapılır (`apply_candidate_decision`). Eser yazılamazsa karar da yazılmaz.
 */
export async function acceptCandidate(c: Candidate): Promise<void> {
  await expectOne(supabase.from('location_candidates').update({ status: 'accepted' }).eq('id', c.id).select('id'));
}

export async function setCandidateStatus(ids: string[], status: Decision): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from('location_candidates').update({ status }).in('id', ids);
  if (error) throw error;
}

/**
 * Hiçbir aday doğru değil: hepsi reddedilir; istenirse eserin mevcut (yanlış) konumu da kaldırılır.
 * Konum önce kaldırılır: ikinci adım düşerse adaylar bekliyor kalır ve işlem güvenle yeniden denenir.
 */
export async function rejectAll(workId: string, clearLocation: boolean): Promise<void> {
  if (clearLocation) {
    await expectOne(supabase.from('works').update({ location: null, location_precision: 'unknown' }).eq('id', workId).select('id'));
  }
  const { error } = await supabase.from('location_candidates').update({ status: 'rejected' }).eq('work_id', workId).eq('status', 'pending');
  if (error) throw error;
}

// ---------- Kitaptan metin taslakları ----------

export type DraftStatus = 'pending' | 'published' | 'rejected';

export interface TextDraft {
  id: string;
  work_id: string;
  page: number;
  page_end: number | null;
  /** Metnin başladığı PDF sayfası (veri hattı hesaplar; kitaplar çift sayfa yayılımı). */
  pdf_page: number | null;
  address: LocalizedText | null;
  history: LocalizedText | null;
  architecture: LocalizedText | null;
  warnings: string[];
  status: DraftStatus;
  decided_at: string | null;
  source: { title: string; url: string | null; volume: number | null };
  work: {
    id: string;
    slug: string;
    name: LocalizedText;
    district: string | null;
    address: LocalizedText | null;
    history: LocalizedText | null;
    architecture: LocalizedText | null;
    cities: { slug: string };
  };
}

export const WARNING_LABEL: Record<string, string> = {
  tr_en_unbalanced: 'TR ve EN uzunlukları çok farklı',
  range_capped: 'Sayfa aralığı kısaltıldı',
  no_address: 'Adres cümlesi bulunamadı',
  unclassified_blocks: 'Dili belirlenemeyen bölüm var',
  needs_review_entry: 'Kitap kaydı kuşkulu',
  address_loose: 'Adres cümlesi tarihçe bilgisi de içerebilir',
  shared_page: 'Sayfayı başka bir eserle paylaşıyor; metinler karışmış olabilir',
};

export const DRAFT_STATUS_LABEL: Record<DraftStatus, string> = { pending: 'Bekliyor', published: 'Yayında', rejected: 'Reddedildi' };

export function useTextDrafts(citySlug: string, status: DraftStatus) {
  return useQuery({
    queryKey: ['text-drafts', citySlug, status],
    queryFn: () =>
      fetchAll<TextDraft>((a, b) =>
        supabase
          .from('text_drafts')
          .select(
            'id, work_id, page, page_end, pdf_page, address, history, architecture, warnings, status, decided_at, source:sources!inner(title, url, volume), work:works!inner(id, slug, name, district, address, history, architecture, cities!inner(slug))',
          )
          .eq('status', status)
          .eq('work.cities.slug', citySlug)
          .order('page')
          .range(a, b),
      ),
  });
}

/**
 * Düzenlenmiş metni yayınlar. Tek istek: taslak satırı düzenlenmiş metinle "yayında" yapılır; tetikleyici
 * (`apply_text_publish`) aynı işlemde esere yazar. Boş alan esere null olarak yazılır.
 */
export async function publishDraft(d: TextDraft, fields: { address: LocalizedText | null; history: LocalizedText | null; architecture: LocalizedText | null }): Promise<void> {
  await expectOne(supabase.from('text_drafts').update({ ...fields, status: 'published' }).eq('id', d.id).select('id'));
}

export async function setDraftStatus(id: string, status: DraftStatus): Promise<void> {
  const { error } = await supabase.from('text_drafts').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Kitap PDF'inde sayfaya bağlantı (tarayıcı PDF görüntüleyicisi `#page=` ile açar). PDF sayfası bilinmiyorsa kitabın başı. */
export const bookPageUrl = (url: string | null, pdfPage: number | null) => (url ? (pdfPage ? `${url}#page=${pdfPage}` : url) : null);
