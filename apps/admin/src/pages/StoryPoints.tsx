import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { StoryMap } from '../components/StoryMap';
import { CITY_CENTER, localized, STATUS_LABEL, useLookups, useStoryPoints, type Status, type StoryRow } from '../lib/data';
import { AUDIO_BASE, supabase } from '../lib/supabase';

type Lang = 'tr' | 'en';
type Pt = [number, number];

const LANGS: Lang[] = ['tr', 'en'];
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const DEFAULT_RADIUS = 25;

interface Form {
  id: string | null;
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  radius: number;
  status: Status;
  sourceNote: string;
  point: Pt | null;
  /** Yeni seçilen ses dosyaları. */
  files: Partial<Record<Lang, File>>;
  /** Mevcut kayıtları kaldır. */
  removed: Record<Lang, boolean>;
}

const emptyForm = (): Form => ({
  id: null,
  title: { tr: '', en: '' },
  body: { tr: '', en: '' },
  radius: DEFAULT_RADIUS,
  status: 'draft',
  sourceNote: '',
  point: null,
  files: {},
  removed: { tr: false, en: false },
});

const toForm = (r: StoryRow): Form => ({
  id: r.id,
  title: { tr: r.title.tr ?? '', en: r.title.en ?? '' },
  body: { tr: r.body?.tr ?? '', en: r.body?.en ?? '' },
  radius: r.radius_m,
  status: r.status,
  sourceNote: r.source_note ?? '',
  point: [r.lng, r.lat],
  files: {},
  removed: { tr: false, en: false },
});

const extOf = (f: File) => f.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';

/** Bu sayfadaki işlemlerin ortak hata iletisi. */
const message = (e: unknown) => (typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e));

/** Anlatım noktası editörü: yürüyüş modunda yarıçapa girilince açılan metin ve ses kaydı. */
export function StoryPoints() {
  const { data: lookups } = useLookups();
  const [city, setCity] = useState('bursa');
  const { data: points = [], isLoading, error } = useStoryPoints(city);
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  const current = points.find((p) => p.id === form.id) ?? null;
  const cityId = lookups?.cities.find((c) => c.slug === city)?.id;
  const center = useMemo<Pt>(() => form.point ?? CITY_CENTER[city] ?? CITY_CENTER.bursa, [form.id, city]); // eslint-disable-line react-hooks/exhaustive-deps

  const select = (r: StoryRow) => {
    setForm(toForm(r));
    setFormError('');
  };
  const reset = () => {
    setForm(emptyForm());
    setFormError('');
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.title.tr.trim()) throw new Error('Türkçe başlık boş olamaz.');
      if (!f.point) throw new Error('Haritaya tıklayarak konum seçin.');
      if (f.radius < 5 || f.radius > 200 || !Number.isFinite(f.radius)) throw new Error('Yarıçap 5 ile 200 m arasında olmalı.');
      if (f.status === 'verified' && !f.body.tr.trim()) throw new Error('Doğrulanmış nokta için Türkçe metin zorunlu.');
      if (f.status === 'verified' && !f.sourceNote.trim()) throw new Error('Doğrulanmış nokta için kaynak notu zorunlu.');
      if (!cityId) throw new Error('İl bulunamadı.');
      const title = localized(f.title)!;
      const id = f.id ?? crypto.randomUUID();
      const old = f.id ? points.find((p) => p.id === f.id) : undefined;

      const uploaded: { lang: Lang; assetId: string | null; path: string }[] = [];
      const rollback = async () => {
        const ids = uploaded.map((u) => u.assetId).filter((x): x is string => !!x);
        if (ids.length) await supabase.from('audio_assets').delete().in('id', ids);
        if (uploaded.length) await supabase.storage.from('audio').remove(uploaded.map((u) => u.path));
      };

      const audioIds: Record<Lang, string | null> = { tr: old?.audio_tr_id ?? null, en: old?.audio_en_id ?? null };
      try {
        for (const lang of LANGS) {
          const file = f.files[lang];
          if (file) {
            const path = `story/${id}/${lang}-${Date.now()}.${extOf(file)}`;
            const entry = { lang, assetId: null as string | null, path };
            const up = await supabase.storage.from('audio').upload(path, file, { contentType: file.type });
            if (up.error) throw up.error;
            uploaded.push(entry);
            const ins = await supabase.from('audio_assets').insert({ storage_path: path, label: `${title.tr} · ${lang.toUpperCase()}` }).select('id').single();
            if (ins.error) throw ins.error;
            entry.assetId = ins.data.id as string;
            audioIds[lang] = entry.assetId;
          } else if (f.removed[lang]) {
            audioIds[lang] = null;
          }
        }
        const { error: e } = await supabase.from('story_points').upsert({
          id,
          city_id: cityId,
          title,
          body: localized(f.body),
          radius_m: Math.round(f.radius),
          source_note: f.sourceNote.trim() || null,
          status: f.status,
          // PostGIS, metin olarak verilen EWKT'yi geography'ye çevirir.
          location: `SRID=4326;POINT(${f.point[0]} ${f.point[1]})`,
          audio_tr_id: audioIds.tr,
          audio_en_id: audioIds.en,
        });
        if (e) throw e;
      } catch (err) {
        await rollback();
        throw err;
      }

      // Kayıt geçerli; değiştirilen ya da kaldırılan eski sesleri temizle.
      let cleanupFailed = false;
      const stale = LANGS.flatMap((lang) => {
        const oldId = lang === 'tr' ? old?.audio_tr_id : old?.audio_en_id;
        const oldPath = lang === 'tr' ? old?.audio_tr : old?.audio_en;
        return oldId && audioIds[lang] !== oldId ? [{ id: oldId, path: oldPath }] : [];
      });
      if (stale.length) {
        const del = await supabase.from('audio_assets').delete().in('id', stale.map((s) => s.id));
        const paths = stale.map((s) => s.path).filter((p): p is string => !!p);
        const rm = paths.length ? await supabase.storage.from('audio').remove(paths) : { error: null };
        cleanupFailed = !!del.error || !!rm.error;
      }
      return { id, cleanupFailed };
    },
    onSuccess: ({ id, cleanupFailed }) => {
      setFormError('');
      setToast(cleanupFailed ? 'Kaydedildi · Eski ses dosyası silinemedi' : 'Kaydedildi');
      void qc.invalidateQueries({ queryKey: ['story_points', city] }).then(async () => {
        const rows = qc.getQueryData<StoryRow[]>(['story_points', city]);
        const saved = rows?.find((r) => r.id === id);
        if (saved) setForm(toForm(saved));
      });
    },
    onError: (e) => setFormError(message(e)),
  });

  const remove = useMutation({
    mutationFn: async (r: StoryRow) => {
      const { error: e } = await supabase.from('story_points').delete().eq('id', r.id);
      if (e) throw e;
      const ids = [r.audio_tr_id, r.audio_en_id].filter((x): x is string => !!x);
      const paths = [r.audio_tr, r.audio_en].filter((x): x is string => !!x);
      let cleanupFailed = false;
      if (ids.length) cleanupFailed = !!(await supabase.from('audio_assets').delete().in('id', ids)).error;
      if (paths.length) cleanupFailed ||= !!(await supabase.storage.from('audio').remove(paths)).error;
      return cleanupFailed;
    },
    onSuccess: (cleanupFailed) => {
      reset();
      setToast(cleanupFailed ? 'Silindi · Ses dosyası silinemedi' : 'Silindi');
      void qc.invalidateQueries({ queryKey: ['story_points', city] });
    },
    onError: (e) => setFormError(message(e)),
  });

  const pickFile = (lang: Lang, file: File | undefined) => {
    if (file && file.size > MAX_AUDIO_BYTES) {
      setFormError('Ses dosyası 10 MB’tan büyük olamaz.');
      return;
    }
    setFormError('');
    setForm((f) => ({ ...f, files: { ...f.files, [lang]: file } }));
  };

  const busy = save.isPending || remove.isPending;

  return (
    <>
      <div className="row">
        <h1 className="grow">Anlatım noktaları</h1>
        <label className="field">
          İl
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              reset();
            }}
          >
            {(lookups?.cities ?? [{ id: 'bursa', slug: 'bursa', name: { tr: 'Bursa' } }]).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name.tr}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" onClick={reset}>
          Yeni nokta
        </button>
      </div>
      {error ? <p className="error">Noktalar alınamadı: {(error as Error).message}</p> : null}

      <div className="edit">
        <div className="stack">
          <StoryMap
            points={points}
            selectedId={form.id}
            draft={form.id && current ? null : form.point}
            draftRadius={form.radius}
            center={center}
            onSelect={(id) => {
              const r = points.find((p) => p.id === id);
              if (r) select(r);
            }}
            onPick={(p) => setForm((f) => ({ ...f, point: p }))}
          />
          {!form.id && !form.point ? <p className="muted" style={{ margin: 0 }}>Haritaya tıklayarak konum seçin.</p> : null}

          {isLoading ? <p className="muted">Yükleniyor…</p> : null}
          {!isLoading && points.length === 0 ? <div className="card muted">Bu ilde anlatım noktası yok.</div> : null}
          {points.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Durum</th>
                  <th>Yarıçap</th>
                  <th>Ses TR</th>
                  <th>Ses EN</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr
                    key={p.id}
                    className="click"
                    tabIndex={0}
                    aria-selected={p.id === form.id}
                    onClick={() => select(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        select(p);
                      }
                    }}
                  >
                    <td>
                      <strong>{p.title.tr}</strong>
                    </td>
                    <td>
                      <span className={`pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td className="num">{p.radius_m} m</td>
                    <td aria-label={p.audio_tr ? 'Türkçe ses var' : 'Türkçe ses yok'}>{p.audio_tr ? '✓' : '—'}</td>
                    <td aria-label={p.audio_en ? 'İngilizce ses var' : 'İngilizce ses yok'}>{p.audio_en ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
        >
          <h2>{form.id ? 'Noktayı düzenle' : 'Yeni nokta'}</h2>
          <div className="pair">
            {LANGS.map((l) => (
              <label className="field" key={l}>
                Başlık ({l.toUpperCase()})
                <input value={form.title[l]} onChange={(e) => setForm({ ...form, title: { ...form.title, [l]: e.target.value } })} />
              </label>
            ))}
          </div>
          <div className="pair">
            {LANGS.map((l) => (
              <label className="field" key={l}>
                Metin ({l.toUpperCase()})
                <textarea value={form.body[l]} onChange={(e) => setForm({ ...form, body: { ...form.body, [l]: e.target.value } })} />
              </label>
            ))}
          </div>
          <div className="pair">
            <label className="field">
              Yarıçap (m)
              <input type="number" min={5} max={200} value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} />
            </label>
            <label className="field">
              Durum
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Status })}>
                {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Kaynak notu
            <input value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} />
          </label>
          <p className="muted num" style={{ margin: 0, fontSize: 13 }}>
            Konum: {form.point ? `${form.point[1]}, ${form.point[0]}` : 'seçilmedi'}
          </p>

          {LANGS.map((l) => {
            const path = l === 'tr' ? current?.audio_tr : current?.audio_en;
            const existing = path && !form.removed[l] && !form.files[l] ? path : null;
            return (
              <div key={l} className="stack" style={{ gap: 8 }}>
                <strong style={{ fontSize: 13 }}>Ses ({l.toUpperCase()})</strong>
                {existing ? (
                  <div className="row">
                    <audio controls src={AUDIO_BASE + existing} />
                    <button type="button" className="btn ghost small" onClick={() => setForm({ ...form, removed: { ...form.removed, [l]: true } })}>
                      Sesi kaldır
                    </button>
                  </div>
                ) : null}
                {path && form.removed[l] && !form.files[l] ? (
                  <span className="muted">
                    Kayıtta kaldırılacak.{' '}
                    <button type="button" className="btn ghost small" onClick={() => setForm({ ...form, removed: { ...form.removed, [l]: false } })}>
                      Geri al
                    </button>
                  </span>
                ) : null}
                <input
                  key={`${form.id}-${l}-${form.files[l]?.name ?? ''}`}
                  type="file"
                  accept=".mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac"
                  aria-label={`Ses dosyası seç (${l.toUpperCase()})`}
                  onChange={(e) => pickFile(l, e.target.files?.[0])}
                />
              </div>
            );
          })}

          {formError ? (
            <p role="alert" className="error" style={{ margin: 0 }}>
              {formError}
            </p>
          ) : null}
          <div className="row">
            <button className="btn" type="submit" disabled={busy}>
              {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {current ? (
              <button
                type="button"
                className="btn outline"
                disabled={busy}
                onClick={() => {
                  if (confirm('Bu anlatım noktası silinsin mi?')) remove.mutate(current);
                }}
              >
                Sil
              </button>
            ) : null}
          </div>
        </form>
      </div>
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </>
  );
}
