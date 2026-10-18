import type { LocalizedText } from '@sezi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { localized, tr, useLookups } from '../lib/data';
import { bookPageUrl, DRAFT_STATUS_LABEL, publishDraft, setDraftStatus, useTextDrafts, WARNING_LABEL, type DraftStatus, type TextDraft } from '../lib/review';

type Field = 'address' | 'history' | 'architecture';
const FIELDS: { key: Field; label: string; rows: number }[] = [
  { key: 'address', label: 'Adres', rows: 4 },
  { key: 'history', label: 'Tarihçe', rows: 14 },
  { key: 'architecture', label: 'Mimari', rows: 8 },
];
type Form = Record<Field, { tr: string; en: string }>;

const toForm = (d: TextDraft): Form => ({
  address: { tr: d.address?.tr ?? '', en: d.address?.en ?? '' },
  history: { tr: d.history?.tr ?? '', en: d.history?.en ?? '' },
  architecture: { tr: d.architecture?.tr ?? '', en: d.architecture?.en ?? '' },
});

const message = (e: unknown) => (typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e));
const STATUSES: DraftStatus[] = ['pending', 'published', 'rejected'];

/**
 * Kitaptan metin taslakları: veri hattı her eserin sayfalarından adres, tarihçe ve mimari metnini (TR/EN) ayırır.
 * Admin kitap sayfasıyla karşılaştırıp düzeltir ve esere yayınlar. Yayınlanan metin uygulamada eser sayfasında görünür.
 */
export function Texts() {
  const [params, setParams] = useSearchParams();
  const city = params.get('city') ?? 'bursa';
  const status = (params.get('status') as DraftStatus | null) ?? 'pending';
  const q = params.get('q') ?? '';
  const slug = params.get('work');
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const { data: lookups } = useLookups();
  const { data, isLoading, error } = useTextDrafts(city, status);
  const qc = useQueryClient();

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    // Kitap sırası: cilt, sonra sayfa.
    return (data ?? [])
      .filter((d) => !needle || tr(d.work.name).toLocaleLowerCase('tr').includes(needle))
      .sort((a, b) => (a.source.volume ?? 0) - (b.source.volume ?? 0) || a.page - b.page);
  }, [data, q]);
  const draft = list.find((d) => d.work.slug === slug) ?? list[0] ?? null;

  const [form, setForm] = useState<Form | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shownDraft, setShownDraft] = useState<string | null>(null);
  // Taslak değişince form ondan kurulur (render sırasında; efektte değil).
  if ((draft?.id ?? null) !== shownDraft) {
    setShownDraft(draft?.id ?? null);
    setForm(draft ? toForm(draft) : null);
    setChecked(false);
    setErr('');
  }

  const act = async (fn: () => Promise<void>) => {
    if (!draft) return;
    setBusy(true);
    setErr('');
    const i = list.findIndex((d) => d.id === draft.id);
    const next = list[i + 1] ?? list[i - 1] ?? null;
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['text-drafts', city] });
      void qc.invalidateQueries({ queryKey: ['work', draft.work.slug] });
      set({ work: next?.work.slug ?? null });
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!draft || !form) return;
    const fields = { address: localized(form.address), history: localized(form.history), architecture: localized(form.architecture) };
    if (!fields.address && !fields.history && !fields.architecture) {
      setErr('Yayınlanacak Türkçe metin yok.');
      return;
    }
    void act(() => publishDraft(draft, fields));
  };

  const cities = (lookups?.cities ?? []).filter((c) => c.slug !== 'istanbul');
  const page = draft ? (draft.page_end && draft.page_end !== draft.page ? `s. ${draft.page}–${draft.page_end}` : `s. ${draft.page}`) : '';
  const bookUrl = draft ? bookPageUrl(draft.source.url, draft.pdf_page) : null;

  return (
    <>
      <div className="row">
        <div className="grow">
          <h1>Eser metinleri</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Envanter kitaplarından (hackathon veri seti) çıkarılan taslaklar. Kitap sayfasıyla karşılaştırıp düzeltin; yayınlanan metin uygulamada eser sayfasında, kitap atfıyla görünür.
          </p>
        </div>
        <label className="field">
          İl
          <select value={city} onChange={(e) => set({ city: e.target.value, work: null })}>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {tr(c.name)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="row">
        <div className="tabs" role="tablist" aria-label="Durum">
          {STATUSES.map((s) => (
            <button key={s} role="tab" aria-selected={status === s} className={status === s ? 'active' : ''} onClick={() => set({ status: s, work: null })}>
              {DRAFT_STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <input type="search" className="grow" style={{ maxWidth: 320 }} placeholder="Eser ara" aria-label="Eser ara" value={q} onChange={(e) => set({ q: e.target.value })} />
        {data ? <span className="muted num">{list.length} taslak</span> : null}
      </div>

      {error ? <p className="error">Taslaklar alınamadı: {message(error)}</p> : null}
      {isLoading ? <p className="muted">Yükleniyor…</p> : null}

      {data ? (
        <div className="texts">
          <ul className="queue" aria-label="Taslaklar">
            {list.length === 0 ? <li className="muted" style={{ padding: 12 }}>Bu süzgeçte taslak yok.</li> : null}
            {list.map((d) => (
              <li key={d.id}>
                <button className={d.id === draft?.id ? 'active' : ''} aria-current={d.id === draft?.id} onClick={() => set({ work: d.work.slug })}>
                  <span className="queue-name">{tr(d.work.name)}</span>
                  <span className="queue-meta">
                    {d.work.district ?? '—'} · {d.source.volume ? `C${d.source.volume} ` : ''}s. {d.page}
                    {d.warnings.length > 0 ? ` · ${d.warnings.length} uyarı` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {draft && form ? (
            <section className="stack" aria-label="Taslak düzenleme">
              <div className="row">
                <div className="grow">
                  <h2>{tr(draft.work.name)}</h2>
                  <span className="muted">
                    {draft.source.title} · {page}
                  </span>
                </div>
                {bookUrl ? (
                  <a className="btn outline small" href={bookUrl} target="_blank" rel="noreferrer">
                    Kitapta aç ↗
                  </a>
                ) : null}
                <Link className="btn ghost small" to={`/eserler/${draft.work.slug}`}>
                  Eseri düzenle
                </Link>
              </div>

              {draft.warnings.length > 0 ? (
                <div className="row" aria-label="Uyarılar">
                  {draft.warnings.map((w) => (
                    <span key={w} className="pill warn">
                      {WARNING_LABEL[w] ?? w}
                    </span>
                  ))}
                </div>
              ) : null}

              {FIELDS.map(({ key, label, rows }) => (
                <div key={key} className="card stack">
                  <div className="row">
                    <strong className="grow">{label}</strong>
                    <PublishedNote value={draft.work[key]} draft={draft[key]} />
                  </div>
                  <div className="pair">
                    {(['tr', 'en'] as const).map((l) => (
                      <label key={l} className="field">
                        {l.toUpperCase()}
                        <textarea
                          rows={rows}
                          style={{ minHeight: rows * 24 }}
                          lang={l}
                          value={form[key][l]}
                          readOnly={draft.status !== 'pending'}
                          onChange={(e) => setForm({ ...form, [key]: { ...form[key], [l]: e.target.value } })}
                        />
                        <span className="muted num small-note">{form[key][l].length} karakter</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {draft.status === 'pending' ? (
                <div className="card stack">
                  <label className="check">
                    <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                    <span>Metni kitaptaki sayfayla karşılaştırdım; ayrıştırma hatası (yanlış dil, eksik paragraf, başka eserin metni) yok.</span>
                  </label>
                  <div className="row">
                    <button className="btn" disabled={busy || !checked} onClick={publish}>
                      Esere yayınla
                    </button>
                    <button className="btn outline" disabled={busy} onClick={() => void act(() => setDraftStatus(draft.id, 'rejected'))}>
                      Reddet
                    </button>
                    <button className="btn ghost" disabled={busy} onClick={() => setForm(toForm(draft))}>
                      Değişiklikleri geri al
                    </button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <span className={`pill ${draft.status === 'published' ? 'verified' : 'archived'}`}>{DRAFT_STATUS_LABEL[draft.status]}</span>
                  <button className="btn ghost small" disabled={busy} onClick={() => void act(() => setDraftStatus(draft.id, 'pending'))} title="Taslak yeniden düzenlenebilir olur; eserdeki metin değişmez">
                    Beklemeye al
                  </button>
                </div>
              )}
              {err ? (
                <p role="alert" className="error" style={{ margin: 0 }}>
                  {err}
                </p>
              ) : null}
            </section>
          ) : (
            <p className="muted">Taslak seçin.</p>
          )}
        </div>
      ) : null}
    </>
  );
}

/** Eserde yayınlanmış metin taslaktan farklıysa uyarır (yayınla eskisinin üzerine yazar). */
function PublishedNote({ value, draft }: { value: LocalizedText | null; draft: LocalizedText | null }) {
  if (!value?.tr) return <span className="muted small-note">Eserde henüz yok</span>;
  if (value.tr === draft?.tr && (value.en ?? '') === (draft?.en ?? '')) return <span className="pill verified">Eserdekiyle aynı</span>;
  return <span className="pill warn">Eserde farklı bir metin var; yayınlamak üzerine yazar</span>;
}
