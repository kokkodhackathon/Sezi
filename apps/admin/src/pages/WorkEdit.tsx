import type { LocalizedText } from '@sezi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';

import { AudioField } from '../components/AudioField';
import { LocationMap } from '../components/LocationMap';
import { LANGS, MAX_AUDIO_BYTES, removeAudio, uploadAudio, type Lang, type Uploaded } from '../lib/audio';
import { CITY_CENTER, CONDITION_LABEL, localized, mediaUrl, STATUS_LABEL, tr, useLookups, useWork, type Condition, type MediaRow, type Precision, type Status, type WorkRecord } from '../lib/data';
import { supabase } from '../lib/supabase';

type TextKey = 'name' | 'period' | 'history' | 'architecture' | 'address' | 'condition_note';

interface Form {
  name: { tr: string; en: string };
  period: { tr: string; en: string };
  history: { tr: string; en: string };
  architecture: { tr: string; en: string };
  address: { tr: string; en: string };
  condition_note: { tr: string; en: string };
  work_type_id: string;
  district: string;
  condition: Condition;
  unesco: boolean;
  status: Status;
  needs_review: boolean;
  point: [number, number] | null;
  precision: Precision;
  /** Yeni seçilen ses dosyaları. */
  files: Partial<Record<Lang, File>>;
  /** Mevcut kayıtları kaldır. */
  removed: Record<Lang, boolean>;
  /** Kayıttan sonra artar: dosya alanları sıfırlanır. */
  rev: number;
}

const text = (t: LocalizedText | null | undefined) => ({ tr: t?.tr ?? '', en: t?.en ?? '' });

function toForm(w: WorkRecord, lng: number | null, lat: number | null): Form {
  return {
    name: text(w.name),
    period: text(w.period),
    history: text(w.history),
    architecture: text(w.architecture),
    address: text(w.address),
    condition_note: text(w.condition_note),
    work_type_id: w.work_type_id,
    district: w.district ?? '',
    condition: w.condition,
    unesco: w.unesco,
    status: w.status,
    needs_review: w.needs_review,
    point: lng !== null && lat !== null ? [lng, lat] : null,
    precision: w.location_precision,
    files: {},
    removed: { tr: false, en: false },
    rev: 0,
  };
}

export function WorkEdit() {
  const { slug = '' } = useParams();
  const { data, isLoading, error, dataUpdatedAt } = useWork(slug);
  if (isLoading) return <p className="muted">Yükleniyor…</p>;
  if (error || !data) return <p className="error">{error ? `Eser alınamadı: ${(error as Error).message}` : 'Eser bulunamadı.'}</p>;
  // Kayıttan sonra veri yenilenince form da sunucudaki son hâlle yeniden kurulur.
  return <Editor key={dataUpdatedAt} slug={slug} data={data} />;
}

type WorkData = NonNullable<ReturnType<typeof useWork>['data']>;

function Editor({ slug, data }: { slug: string; data: WorkData }) {
  const { data: lookups } = useLookups();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(() => toForm(data.work, data.lng, data.lat));
  const [toast, setToast] = useState('');
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.tr.trim()) throw new Error('Türkçe ad boş olamaz.');
      const old: Record<Lang, string | null> = { tr: data.work.audio_tr_id, en: data.work.audio_en_id };
      const audioIds = { ...old };
      const uploaded: Uploaded[] = [];
      try {
        for (const lang of LANGS) {
          const file = f.files[lang];
          if (file) audioIds[lang] = await uploadAudio(`works/${data.work.id}`, lang, file, `${f.name.tr.trim()} · ${lang.toUpperCase()}`, uploaded);
          else if (f.removed[lang]) audioIds[lang] = null;
        }
        const { error: e } = await supabase
          .from('works')
          .update({
            name: localized(f.name),
            period: localized(f.period),
            history: localized(f.history),
            architecture: localized(f.architecture),
            address: localized(f.address),
            condition_note: localized(f.condition_note),
            work_type_id: f.work_type_id,
            district: f.district.trim() || null,
            condition: f.condition,
            unesco: f.unesco,
            status: f.status,
            needs_review: f.needs_review,
            // PostGIS, metin olarak verilen EWKT'yi geography'ye çevirir.
            location: f.point ? `SRID=4326;POINT(${f.point[0]} ${f.point[1]})` : null,
            location_precision: f.point ? f.precision : 'unknown',
            audio_tr_id: audioIds.tr,
            audio_en_id: audioIds.en,
          })
          .eq('id', data.work.id);
        if (e) throw e;
      } catch (err) {
        await removeAudio(
          uploaded.map((u) => u.assetId).filter((x): x is string => !!x),
          uploaded.map((u) => u.path),
        );
        throw err;
      }
      // Kayıt geçerli; değiştirilen ya da kaldırılan eski sesleri temizle.
      const stale = LANGS.filter((lang) => old[lang] && audioIds[lang] !== old[lang]);
      return removeAudio(
        stale.map((lang) => old[lang]!),
        stale.map((lang) => data.audio[lang]).filter((p): p is string => !!p),
      );
    },
    onSuccess: (cleanupFailed) => {
      void qc.invalidateQueries({ queryKey: ['work', slug] });
      void qc.invalidateQueries({ queryKey: ['works'] });
      setForm((f) => ({ ...f, files: {}, removed: { tr: false, en: false }, rev: f.rev + 1 }));
      setToast(cleanupFailed ? 'Kaydedildi · Eski ses dosyası silinemedi' : 'Kaydedildi');
    },
  });

  const media = useMutation({
    mutationFn: async ({ row, patch }: { row: MediaRow; patch: Partial<MediaRow> }) => {
      const { error: e } = await supabase.from('media').update(patch).eq('id', row.id);
      if (e) throw e;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['work', slug] });
      void qc.invalidateQueries({ queryKey: ['works'] });
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const setText = (k: TextKey, lang: Lang, v: string) => setForm({ ...form, [k]: { ...form[k], [lang]: v } });
  const inv = data.sources.find((s) => s.kind === 'inventory');
  const makeCover = async (row: MediaRow) => {
    // Seçilen fotoğraf başa, diğerleri mevcut sırasıyla arkasına.
    const order = [row, ...data.media.filter((m) => m.id !== row.id)];
    for (const [i, m] of order.entries()) await supabase.from('media').update({ sort_order: i }).eq('id', m.id);
    void qc.invalidateQueries({ queryKey: ['work', slug] });
    void qc.invalidateQueries({ queryKey: ['works'] });
  };

  return (
    <>
      <div className="row">
        <Link to="/eserler" className="btn ghost small">
          ← Eserler
        </Link>
      </div>
      <div className="row">
        <div className="grow" style={{ display: 'grid', gap: 4 }}>
          <h1>{form.name.tr || data.work.slug}</h1>
          <span className="muted">
            {data.work.slug} · <span className={`pill ${data.work.status}`}>{STATUS_LABEL[data.work.status]}</span>
            {data.work.needs_review ? <span className="pill warn"> İnceleme bekliyor</span> : null}
          </span>
        </div>
        {data.work.status !== 'verified' ? (
          <button className="btn outline" onClick={() => save.mutate({ ...form, status: 'verified', needs_review: false })} disabled={save.isPending}>
            Doğrula ve yayımla
          </button>
        ) : (
          <button className="btn outline" onClick={() => save.mutate({ ...form, status: 'draft' })} disabled={save.isPending}>
            Taslağa al
          </button>
        )}
        <button className="btn" onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      {save.error ? (
        <p role="alert" className="error">
          Kaydedilemedi: {(save.error as Error).message}
        </p>
      ) : null}

      <div className="edit">
        <div className="stack">
          <Section title="Kimlik">
            <Pair label="Ad" value={form.name} onChange={(l, v) => setText('name', l, v)} />
            <div className="pair">
              <label className="field">
                Tür
                <select value={form.work_type_id} onChange={(e) => set('work_type_id', e.target.value)}>
                  {lookups?.types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {tr(t.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                İlçe
                <input value={form.district} onChange={(e) => set('district', e.target.value)} />
              </label>
            </div>
            <Pair label="Adres" value={form.address} onChange={(l, v) => setText('address', l, v)} />
          </Section>

          <Section title="İçerik" note="Tarihçe, mimari ve dönem bilgisi ancak kaynağıyla girilir. Envanter kitaplarındaki metinler resmî paylaşım gelene kadar kopyalanmaz.">
            <Pair label="Dönem" value={form.period} onChange={(l, v) => setText('period', l, v)} />
            <Pair label="Tarihçe" value={form.history} onChange={(l, v) => setText('history', l, v)} multiline />
            <Pair label="Mimari" value={form.architecture} onChange={(l, v) => setText('architecture', l, v)} multiline />
            <div className="pair">
              <label className="field">
                Bugünkü durum
                <select value={form.condition} onChange={(e) => set('condition', e.target.value as Condition)}>
                  {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ alignContent: 'end' }}>
                <span className="row" style={{ gap: 8, color: 'var(--text)', fontSize: 15 }}>
                  <input type="checkbox" checked={form.unesco} onChange={(e) => set('unesco', e.target.checked)} /> UNESCO Dünya Mirası
                </span>
              </label>
            </div>
            <Pair label="Durum notu" value={form.condition_note} onChange={(l, v) => setText('condition_note', l, v)} />
          </Section>

          <Section title="Yayın">
            <div className="pair">
              <label className="field">
                İçerik durumu
                <select value={form.status} onChange={(e) => set('status', e.target.value as Status)}>
                  <option value="draft">Taslak (uygulamada görünmez)</option>
                  <option value="verified">Doğrulandı (uygulamada görünür)</option>
                  <option value="archived">Arşivde</option>
                </select>
              </label>
              <label className="field" style={{ alignContent: 'end' }}>
                <span className="row" style={{ gap: 8, color: 'var(--text)', fontSize: 15 }}>
                  <input type="checkbox" checked={form.needs_review} onChange={(e) => set('needs_review', e.target.checked)} /> İnceleme bekliyor
                </span>
              </label>
            </div>
          </Section>
        </div>

        <div className="stack">
          <Section title="Konum" note="Haritaya tıklayın ya da iğneyi sürükleyin. Sahada ya da güvenilir haritada doğruladığınız konum için “Kesin” seçin.">
            <LocationMap value={form.point} fallbackCenter={CITY_CENTER[data.citySlug] ?? CITY_CENTER.bursa} onChange={(p) => setForm({ ...form, point: p, precision: form.precision === 'unknown' ? 'exact' : form.precision })} />
            <div className="row">
              <label className="field grow">
                Kesinlik
                <select value={form.point ? form.precision : 'unknown'} disabled={!form.point} onChange={(e) => set('precision', e.target.value as Precision)}>
                  <option value="exact">Kesin</option>
                  <option value="approximate">Yaklaşık</option>
                  <option value="unknown">Yok</option>
                </select>
              </label>
              {form.point ? (
                <>
                  <span className="muted num" style={{ alignSelf: 'end', paddingBottom: 8 }}>
                    {form.point[1].toFixed(5)}, {form.point[0].toFixed(5)}
                  </span>
                  <button className="btn ghost small" style={{ alignSelf: 'end' }} onClick={() => setForm({ ...form, point: null, precision: 'unknown' })}>
                    Konumu kaldır
                  </button>
                </>
              ) : null}
            </div>
          </Section>

          <Section title="Ses kaydı" note="Yüklenen kayıt uygulamada metin okuması yerine çalar. Kaydın içeriği de kaynağıyla girilir.">
            {LANGS.map((l) => (
              <AudioField
                key={l}
                lang={l}
                path={data.audio[l]}
                file={form.files[l]}
                removed={form.removed[l]}
                rev={form.rev}
                onRemove={() => setForm({ ...form, removed: { ...form.removed, [l]: true } })}
                onUndo={() => setForm({ ...form, removed: { ...form.removed, [l]: false } })}
                onPick={(file) => {
                  if (file && file.size > MAX_AUDIO_BYTES) {
                    setFileError('Ses dosyası 10 MB’tan büyük olamaz.');
                    return;
                  }
                  setFileError('');
                  setForm((f) => ({ ...f, files: { ...f.files, [l]: file } }));
                }}
              />
            ))}
            {fileError ? (
              <p role="alert" className="error" style={{ margin: 0 }}>
                {fileError}
              </p>
            ) : null}
          </Section>

          <Section title={`Fotoğraflar (${data.media.length})`} note="Taslak fotoğraflar uygulamada görünmez. Eşleşmeyi kitaptaki sayfayla karşılaştırıp onaylayın.">
            {data.media.length === 0 ? <p className="muted">Bu esere bağlı fotoğraf yok.</p> : null}
            <div className="photos">
              {data.media.map((m, i) => (
                <div className="photo" key={m.id}>
                  <a href={mediaUrl(m.storage_path)} target="_blank" rel="noreferrer">
                    <img src={mediaUrl(m.thumb_path ?? m.storage_path)} alt={tr(m.alt_text)} loading="lazy" />
                  </a>
                  <span className="row" style={{ gap: 6 }}>
                    <span className={`pill ${m.status}`}>{STATUS_LABEL[m.status]}</span>
                    {i === 0 ? <span className="pill">Kapak</span> : null}
                  </span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {m.source_page ? `Kitap: C${m.source_volume ?? '?'} s. ${m.source_page}` : 'Kitapta bulunamadı'}
                  </span>
                  <span className="row" style={{ gap: 4 }}>
                    {m.status !== 'verified' ? (
                      <button className="btn small" onClick={() => media.mutate({ row: m, patch: { status: 'verified' } })}>
                        Onayla
                      </button>
                    ) : (
                      <button className="btn outline small" onClick={() => media.mutate({ row: m, patch: { status: 'draft' } })}>
                        Gizle
                      </button>
                    )}
                    {i > 0 ? (
                      <button className="btn ghost small" onClick={() => void makeCover(m)}>
                        Kapak yap
                      </button>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Kaynaklar">
            {data.sources.length === 0 ? <p className="muted">Kaynak yok.</p> : null}
            {data.sources.map((s) => (
              <div key={`${s.title}-${s.page}`} style={{ display: 'grid', gap: 2 }}>
                <strong>{s.title}</strong>
                <span className="muted">
                  {[s.volume ? `Cilt ${s.volume}` : null, s.page ? `s. ${s.page}` : null].filter(Boolean).join(' · ')}
                  {s.url ? (
                    <>
                      {' · '}
                      <a href={s.url} target="_blank" rel="noreferrer">
                        Kitabı aç
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
            ))}
            {inv?.page ? <span className="muted">Kontrol için: kitapta {inv.page}. sayfa.</span> : null}
          </Section>
        </div>
      </div>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="card stack">
      <div style={{ display: 'grid', gap: 4 }}>
        <h2>{title}</h2>
        {note ? <p className="muted" style={{ margin: 0, fontSize: 13 }}>{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** TR ve EN alanı yan yana: aynı içeriğin iki dili birlikte düzenlenir. */
function Pair({ label, value, onChange, multiline }: { label: string; value: { tr: string; en: string }; onChange: (lang: Lang, v: string) => void; multiline?: boolean }) {
  const Field = multiline ? 'textarea' : 'input';
  return (
    <div className="pair">
      {(['tr', 'en'] as Lang[]).map((l) => (
        <label className="field" key={l}>
          {label} ({l.toUpperCase()})
          <Field value={value[l]} onChange={(e: { target: { value: string } }) => onChange(l, e.target.value)} />
        </label>
      ))}
    </div>
  );
}
