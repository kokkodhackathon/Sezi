import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { AudioField } from '../components/AudioField';
import { hasRadius, PointsMap, primaryRole, ROLE_COLOR } from '../components/PointsMap';
import { LANGS, MAX_AUDIO_BYTES, removeAudio, uploadAudio, type Lang, type Uploaded } from '../lib/audio';
import {
  AMBIENT_LABEL,
  CITY_CENTER,
  localized,
  ROLE_HINT,
  ROLE_LABEL,
  searchWorks,
  STATUS_LABEL,
  useLookups,
  usePoints,
  type Ambient,
  type PointRole,
  type PointRow,
  type Status,
} from '../lib/data';
import { supabase } from '../lib/supabase';

type Pt = [number, number];
type WorkHit = Awaited<ReturnType<typeof searchWorks>>[number];

const ROLES: PointRole[] = ['start', 'landmark', 'story', 'arrival'];
const DEFAULT_RADIUS = 25;

interface Form {
  id: string | null;
  roles: PointRole[];
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  radius: number;
  status: Status;
  sourceNote: string;
  point: Pt | null;
  work: { id: string; name: string } | null;
  salience: number;
  ambient: Ambient | '';
  fieldChecked: boolean;
  sortOrder: number;
  /** Yeni seçilen ses dosyaları. */
  files: Partial<Record<Lang, File>>;
  /** Mevcut kayıtları kaldır. */
  removed: Record<Lang, boolean>;
  /** Form her yeniden kurulduğunda değişir: dosya alanları sıfırlanır. */
  rev: number;
}

const emptyForm = (): Form => ({
  id: null,
  roles: ['story'],
  title: { tr: '', en: '' },
  body: { tr: '', en: '' },
  radius: DEFAULT_RADIUS,
  status: 'draft',
  sourceNote: '',
  point: null,
  work: null,
  salience: 2,
  ambient: '',
  fieldChecked: false,
  sortOrder: 0,
  files: {},
  removed: { tr: false, en: false },
  rev: Date.now(),
});

const toForm = (r: PointRow, workName?: string): Form => ({
  id: r.id,
  roles: r.roles,
  title: { tr: r.title.tr ?? '', en: r.title.en ?? '' },
  body: { tr: r.body?.tr ?? '', en: r.body?.en ?? '' },
  radius: r.radius_m,
  status: r.status,
  sourceNote: r.source_note ?? '',
  point: [r.lng, r.lat],
  work: r.work_id ? { id: r.work_id, name: workName ?? r.work_slug ?? '' } : null,
  salience: r.salience ?? 2,
  ambient: r.ambient ?? '',
  fieldChecked: r.field_checked,
  sortOrder: r.sort_order,
  files: {},
  removed: { tr: false, en: false },
  rev: Date.now(),
});

/** Metin ve ses yalnızca anlatım ve varış noktalarında var. */
const hasText = (roles: PointRole[]) => hasRadius(roles);

/** Bu sayfadaki işlemlerin ortak hata iletisi. */
const message = (e: unknown) => (typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e));

/**
 * Nokta editörü: rotaların kullandığı her yer buradan girilir (kodda sabit nokta yok).
 * Başlangıç, yer işareti, anlatım ve eser varışı rolleri; bir yer birden çok rol taşıyabilir.
 */
export function Points() {
  const { data: lookups } = useLookups();
  const [city, setCity] = useState('bursa');
  const { data: points = [], isLoading, error } = usePoints(city);
  const [filter, setFilter] = useState<PointRole | 'all'>('all');
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [workQuery, setWorkQuery] = useState('');
  const [workHits, setWorkHits] = useState<WorkHit[]>([]);
  const qc = useQueryClient();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  // Eser arama (varış noktası için): yazmayı bırakınca sorgula.
  useEffect(() => {
    if (!form.roles.includes('arrival') || form.work) return;
    let alive = true;
    const id = setTimeout(() => {
      searchWorks(workQuery, city)
        .then((hits) => alive && setWorkHits(hits))
        .catch(() => alive && setWorkHits([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [workQuery, city, form.roles, form.work]);

  const current = points.find((p) => p.id === form.id) ?? null;
  const cityId = lookups?.cities.find((c) => c.slug === city)?.id;
  const center = useMemo<Pt>(() => form.point ?? CITY_CENTER[city] ?? CITY_CENTER.bursa, [form.id, city]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = filter === 'all' ? points : points.filter((p) => p.roles.includes(filter));
  const counts = useMemo(() => Object.fromEntries(ROLES.map((r) => [r, points.filter((p) => p.roles.includes(r)).length])) as Record<PointRole, number>, [points]);

  const select = (r: PointRow) => {
    setForm(toForm(r));
    setFormError('');
    setWorkQuery('');
  };
  const reset = () => {
    setForm(emptyForm());
    setFormError('');
    setWorkQuery('');
  };
  const toggleRole = (role: PointRole) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role], ...(role === 'arrival' && f.roles.includes(role) ? { work: null } : {}) }));

  /** Eser seçilince konum boşsa eserin konumu kullanılır. */
  const chooseWork = async (w: WorkHit) => {
    setForm((f) => ({ ...f, work: { id: w.id, name: w.name.tr ?? w.slug }, title: f.title.tr ? f.title : { tr: w.name.tr ?? '', en: w.name.en ?? '' } }));
    setWorkHits([]);
    if (form.point) return;
    const { data } = await supabase.from('works_view').select('lng, lat').eq('id', w.id).single();
    if (data?.lng != null && data?.lat != null) setForm((f) => (f.point ? f : { ...f, point: [data.lng as number, data.lat as number] }));
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const text = hasText(f.roles);
      if (f.roles.length === 0) throw new Error('En az bir rol seçin.');
      if (!f.title.tr.trim()) throw new Error('Türkçe ad boş olamaz.');
      if (!f.point) throw new Error('Haritaya tıklayarak konum seçin.');
      if (f.roles.includes('arrival') && !f.work) throw new Error('Varış noktası için eser seçin.');
      if (text && (f.radius < 5 || f.radius > 200 || !Number.isFinite(f.radius))) throw new Error('Yarıçap 5 ile 200 m arasında olmalı.');
      if (f.status === 'verified' && text && !f.body.tr.trim()) throw new Error('Yayındaki anlatım/varış noktası için Türkçe metin zorunlu.');
      if (f.status === 'verified' && !f.sourceNote.trim()) throw new Error('Yayındaki nokta için kaynak notu zorunlu.');
      if (!cityId) throw new Error('İl bulunamadı.');
      const title = localized(f.title)!;
      const id = f.id ?? crypto.randomUUID();
      const old = f.id ? points.find((p) => p.id === f.id) : undefined;
      // Anlatım/varış rolü kalktıysa metin ve sesler de kalkar (gizli, bayat içerik kalmasın).
      const removed = text ? f.removed : { tr: true, en: true };
      const files = text ? f.files : {};

      const uploaded: Uploaded[] = [];
      const rollback = () =>
        removeAudio(
          uploaded.map((u) => u.assetId).filter((x): x is string => !!x),
          uploaded.map((u) => u.path),
        );

      const audioIds: Record<Lang, string | null> = { tr: old?.audio_tr_id ?? null, en: old?.audio_en_id ?? null };
      try {
        for (const lang of LANGS) {
          const file = files[lang];
          if (file) {
            audioIds[lang] = await uploadAudio(`points/${id}`, lang, file, `${title.tr} · ${lang.toUpperCase()}`, uploaded);
          } else if (removed[lang]) {
            audioIds[lang] = null;
          }
        }
        const landmark = f.roles.includes('landmark');
        const { error: e } = await supabase.from('nav_points').upsert({
          id,
          city_id: cityId,
          roles: f.roles,
          title,
          body: text ? localized(f.body) : null,
          radius_m: Math.round(text ? f.radius : DEFAULT_RADIUS),
          source_note: f.sourceNote.trim() || null,
          status: f.status,
          // PostGIS, metin olarak verilen EWKT'yi geography'ye çevirir.
          location: `SRID=4326;POINT(${f.point[0]} ${f.point[1]})`,
          work_id: f.roles.includes('arrival') ? f.work!.id : null,
          salience: landmark ? f.salience : null,
          ambient: landmark && f.ambient ? f.ambient : null,
          field_checked: f.fieldChecked,
          sort_order: f.roles.includes('start') ? Math.round(f.sortOrder) : 0,
          audio_tr_id: audioIds.tr,
          audio_en_id: audioIds.en,
        });
        if (e) throw e;
      } catch (err) {
        await rollback();
        throw err;
      }

      // Kayıt geçerli; değiştirilen ya da kaldırılan eski sesleri temizle.
      const stale = LANGS.flatMap((lang) => {
        const oldId = lang === 'tr' ? old?.audio_tr_id : old?.audio_en_id;
        const oldPath = lang === 'tr' ? old?.audio_tr : old?.audio_en;
        return oldId && audioIds[lang] !== oldId ? [{ id: oldId, path: oldPath }] : [];
      });
      const cleanupFailed = await removeAudio(
        stale.map((s) => s.id),
        stale.map((s) => s.path).filter((p): p is string => !!p),
      );
      return { id, cleanupFailed, workName: f.work?.name };
    },
    onSuccess: ({ id, cleanupFailed, workName }) => {
      setFormError('');
      setToast(cleanupFailed ? 'Kaydedildi · Eski ses dosyası silinemedi' : 'Kaydedildi');
      void qc.invalidateQueries({ queryKey: ['nav_points', city] }).then(() => {
        const rows = qc.getQueryData<PointRow[]>(['nav_points', city]);
        const saved = rows?.find((r) => r.id === id);
        if (saved) setForm(toForm(saved, workName));
      });
    },
    onError: (e) => setFormError(message(e)),
  });

  const remove = useMutation({
    mutationFn: async (r: PointRow) => {
      const { error: e } = await supabase.from('nav_points').delete().eq('id', r.id);
      if (e) throw e;
      return removeAudio(
        [r.audio_tr_id, r.audio_en_id].filter((x): x is string => !!x),
        [r.audio_tr, r.audio_en].filter((x): x is string => !!x),
      );
    },
    onSuccess: (cleanupFailed) => {
      reset();
      setToast(cleanupFailed ? 'Silindi · Ses dosyası silinemedi' : 'Silindi');
      void qc.invalidateQueries({ queryKey: ['nav_points', city] });
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
  const text = hasText(form.roles);

  return (
    <>
      <div className="row">
        <div className="grow stack" style={{ gap: 4 }}>
          <h1>Noktalar</h1>
          <p className="muted" style={{ margin: 0 }}>
            Rotalar bu noktalardan hesaplanır: kullanıcı bir başlangıçtan hedefe giderken yakındaki anlatım noktalarına uğrar, yer işaretleri talimatlarda anılır.
          </p>
        </div>
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
          <div className="row" role="tablist" aria-label="Role göre süz">
            {(['all', ...ROLES] as const).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={filter === r}
                className={`btn small ${filter === r ? '' : 'outline'}`}
                onClick={() => setFilter(r)}
              >
                {r === 'all' ? (
                  `Tümü · ${points.length}`
                ) : (
                  <>
                    <span aria-hidden className="dot" style={{ background: ROLE_COLOR[r] }} /> {ROLE_LABEL[r]} · {counts[r]}
                  </>
                )}
              </button>
            ))}
          </div>
          <PointsMap
            points={visible}
            selectedId={form.id}
            draft={form.id && current ? null : form.point}
            draftRadius={text ? form.radius : null}
            center={center}
            onSelect={(id) => {
              const r = points.find((p) => p.id === id);
              if (r) select(r);
            }}
            onPick={(p) => setForm((f) => ({ ...f, point: p }))}
          />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Haritada boş yere tıklayınca yeni noktanın konumu seçilir; işaret sürüklenebilir. Soluk noktalar taslaktır, uygulamada görünmez.
          </p>

          {isLoading ? <p className="muted">Yükleniyor…</p> : null}
          {!isLoading && visible.length === 0 ? <div className="card muted">Bu ilde bu türde nokta yok.</div> : null}
          {visible.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Ad</th>
                  <th>Roller</th>
                  <th>Durum</th>
                  <th>Ses</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
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
                      <span aria-hidden className="dot" style={{ background: ROLE_COLOR[primaryRole(p.roles)] }} /> <strong>{p.title.tr}</strong>
                    </td>
                    <td>{p.roles.map((r) => ROLE_LABEL[r]).join(', ')}</td>
                    <td>
                      <span className={`pill ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td aria-label={[p.audio_tr ? 'Türkçe ses var' : null, p.audio_en ? 'İngilizce ses var' : null].filter(Boolean).join(', ') || 'Ses yok'}>
                      {[p.audio_tr ? 'TR' : null, p.audio_en ? 'EN' : null].filter(Boolean).join(' · ') || '—'}
                    </td>
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

          <fieldset className="stack" style={{ gap: 8, border: 0, padding: 0, margin: 0 }}>
            <legend className="label">Roller</legend>
            {ROLES.map((r) => (
              <label key={r} className="check">
                <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                <span>
                  <span aria-hidden className="dot" style={{ background: ROLE_COLOR[r] }} /> <strong>{ROLE_LABEL[r]}</strong>
                  <span className="muted" style={{ display: 'block', fontSize: 13 }}>
                    {ROLE_HINT[r]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {form.roles.includes('arrival') ? (
            <div className="stack" style={{ gap: 6 }}>
              <span className="label">Eser</span>
              {form.work ? (
                <div className="row">
                  <strong className="grow">{form.work.name}</strong>
                  <button type="button" className="btn ghost small" onClick={() => setForm({ ...form, work: null })}>
                    Değiştir
                  </button>
                </div>
              ) : (
                <>
                  <input value={workQuery} onChange={(e) => setWorkQuery(e.target.value)} placeholder="Eser adı yazın" aria-label="Eser ara" />
                  <ul className="picklist">
                    {workHits.map((w) => (
                      <li key={w.id}>
                        <button type="button" onClick={() => void chooseWork(w)}>
                          {w.name.tr} <span className="muted">· {w.type_name.tr}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : null}

          <div className="pair">
            {LANGS.map((l) => (
              <label className="field" key={l}>
                Ad ({l.toUpperCase()})
                <input value={form.title[l]} onChange={(e) => setForm({ ...form, title: { ...form.title, [l]: e.target.value } })} />
              </label>
            ))}
          </div>

          {text ? (
            <>
              <div className="pair">
                {LANGS.map((l) => (
                  <label className="field" key={l}>
                    Metin ({l.toUpperCase()})
                    <textarea value={form.body[l]} onChange={(e) => setForm({ ...form, body: { ...form.body, [l]: e.target.value } })} />
                  </label>
                ))}
              </div>
              <label className="field">
                Yarıçap (m): yaklaşınca açılma mesafesi
                <input type="number" min={5} max={200} value={form.radius} onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })} />
              </label>
            </>
          ) : null}

          {form.roles.includes('landmark') ? (
            <div className="pair">
              <label className="field">
                Belirginlik
                <select value={form.salience} onChange={(e) => setForm({ ...form, salience: Number(e.target.value) })}>
                  <option value={1}>1 · Az görünür</option>
                  <option value={2}>2 · Görünür</option>
                  <option value={3}>3 · Uzaktan görünür</option>
                </select>
              </label>
              <label className="field">
                Ortam sesi
                <select value={form.ambient} onChange={(e) => setForm({ ...form, ambient: e.target.value as Ambient | '' })}>
                  <option value="">Yok</option>
                  {(Object.keys(AMBIENT_LABEL) as Ambient[]).map((a) => (
                    <option key={a} value={a}>
                      {AMBIENT_LABEL[a]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {form.roles.includes('start') ? (
            <label className="field">
              Başlangıç listesindeki sıra (en küçük varsayılan)
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
            </label>
          ) : null}

          <div className="pair">
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
            <label className="check" style={{ alignSelf: 'end' }}>
              <input type="checkbox" checked={form.fieldChecked} onChange={(e) => setForm({ ...form, fieldChecked: e.target.checked })} />
              <span>Sahada doğrulandı</span>
            </label>
          </div>
          <label className="field">
            Kaynak notu (metnin ve konumun kaynağı)
            <textarea style={{ minHeight: 64 }} value={form.sourceNote} onChange={(e) => setForm({ ...form, sourceNote: e.target.value })} />
          </label>
          <p className="muted num" style={{ margin: 0, fontSize: 13 }}>
            Konum: {form.point ? `${form.point[1]}, ${form.point[0]}` : 'seçilmedi'}
          </p>

          {text
            ? LANGS.map((l) => (
                <AudioField
                  key={l}
                  lang={l}
                  path={l === 'tr' ? current?.audio_tr : current?.audio_en}
                  file={form.files[l]}
                  removed={form.removed[l]}
                  rev={form.rev}
                  onRemove={() => setForm({ ...form, removed: { ...form.removed, [l]: true } })}
                  onUndo={() => setForm({ ...form, removed: { ...form.removed, [l]: false } })}
                  onPick={(f) => pickFile(l, f)}
                />
              ))
            : null}

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
                  if (confirm('Bu nokta silinsin mi?')) remove.mutate(current);
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
