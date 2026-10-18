import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { CandidatesMap } from '../components/CandidatesMap';
import { CITY_CENTER, PRECISION_LABEL, tr, useLookups } from '../lib/data';
import {
  acceptCandidate,
  distanceM,
  formatDistance,
  LEVEL_LABEL,
  queueState,
  rejectAll,
  setCandidateStatus,
  SOURCE_COLOR,
  SOURCE_LABEL,
  sourceUrl,
  STATE_LABEL,
  useMatchQueue,
  type Candidate,
  type QueueState,
  type QueueWork,
} from '../lib/review';

const STATES: QueueState[] = ['pending', 'conflict', 'none', 'decided'];

const message = (e: unknown) => (typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e));

/**
 * Konum eşleştirme masası: veri hattının her eser için önerdiği adaylar haritada ve kartlarda.
 * Admin bir adayı kabul eder (eserin konumu olur) ya da hepsini reddeder. Klavye: J/K eser, 1–9 aday, Enter kabul.
 */
export function Matching() {
  const [params, setParams] = useSearchParams();
  const city = params.get('city') ?? 'bursa';
  const state = (params.get('state') as QueueState | null) ?? 'pending';
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
  const { data, isLoading, error } = useMatchQueue(city);
  const qc = useQueryClient();

  const states = useMemo(() => {
    const m = new Map<string, QueueState>();
    for (const w of data?.works ?? []) m.set(w.id, queueState(data?.byWork.get(w.id)));
    return m;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<QueueState, number> = { pending: 0, conflict: 0, none: 0, decided: 0 };
    for (const s of states.values()) c[s]++;
    return c;
  }, [states]);

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    const best = (w: QueueWork) => data?.byWork.get(w.id)?.find((c) => !c.vetoed)?.score ?? 0;
    return (data?.works ?? [])
      .filter((w) => states.get(w.id) === state)
      .filter((w) => !needle || tr(w.name).toLocaleLowerCase('tr').includes(needle) || (w.district ?? '').toLocaleLowerCase('tr').includes(needle))
      .sort((a, b) => best(b) - best(a));
  }, [data, states, state, q]);

  const work = data?.works.find((w) => w.slug === slug) ?? list[0] ?? null;
  const candidates = useMemo(() => (work ? (data?.byWork.get(work.id) ?? []) : []), [data, work]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [clearLocation, setClearLocation] = useState(false);
  const [shownWork, setShownWork] = useState<string | null>(null);

  // Eser değişince ilk vetosuz aday seçilir (render sırasında; efektte değil).
  if ((work?.id ?? null) !== shownWork) {
    setShownWork(work?.id ?? null);
    setSelected(candidates.find((c) => !c.vetoed)?.id ?? candidates[0]?.id ?? null);
    setErr('');
    setClearLocation(false);
  }

  const go = (delta: number) => {
    if (list.length === 0) return;
    const i = work ? list.findIndex((w) => w.id === work.id) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, i + delta))];
    if (next) set({ work: next.slug });
  };

  /** Karardan sonra listede bir sonraki esere geçilir (karar verilen eser bu süzgeçten çıkar). */
  const decide = async (action: () => Promise<void>) => {
    if (!work) return;
    setBusy(true);
    setErr('');
    const i = list.findIndex((w) => w.id === work.id);
    const next = list[i + 1] ?? list[i - 1] ?? null;
    try {
      await action();
      await qc.invalidateQueries({ queryKey: ['match-queue', city] });
      void qc.invalidateQueries({ queryKey: ['works'] });
      void qc.invalidateQueries({ queryKey: ['work', work.slug] });
      if (state !== 'decided') set({ work: next?.slug ?? null });
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(false);
    }
  };

  const accept = (c: Candidate) => {
    if (!work) return;
    if (c.vetoed && !window.confirm('Bu aday tür ya da ilçe bakımından çelişkili. Yine de eserin konumu yapılsın mı?')) return;
    void decide(() => acceptCandidate(c));
  };

  // Klavye kısayolları (yazı alanındayken devre dışı).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (busy || e.ctrlKey || e.metaKey || e.altKey || t.closest('input, textarea, select')) return;
      if (e.key === 'j' || e.key === 'J') go(1);
      else if (e.key === 'k' || e.key === 'K') go(-1);
      else if (/^[1-9]$/.test(e.key)) {
        const c = candidates[Number(e.key) - 1];
        if (c) setSelected(c.id);
      } else if (e.key === 'Enter' && !t.closest('button, a')) {
        const c = candidates.find((x) => x.id === selected);
        if (c && c.status === 'pending') accept(c);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cities = (lookups?.cities ?? []).filter((c) => c.slug !== 'istanbul');
  const typeName = (slug: string | null | undefined) => (slug ? tr(lookups?.types.find((t) => t.slug === slug)?.name) || slug : '?');
  const current: [number, number] | null = work && work.lng !== null && work.lat !== null ? [work.lng, work.lat] : null;

  return (
    <>
      <div className="row">
        <div className="grow">
          <h1>Konum eşleştirme</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Veri hattı her eser için Wikidata, OpenStreetMap ve önceki eşleşmeden aday önerir. Tür ya da ilçe tutmayan aday çelişkili işaretlenir. Kabul ettiğiniz aday eserin konumu olur.
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
        <div className="tabs" role="tablist" aria-label="Kuyruk">
          {STATES.map((s) => (
            <button key={s} role="tab" aria-selected={state === s} className={state === s ? 'active' : ''} onClick={() => set({ state: s, work: null })}>
              {STATE_LABEL[s]} <span className="num">{counts[s]}</span>
            </button>
          ))}
        </div>
        <input type="search" className="grow" style={{ maxWidth: 320 }} placeholder="Eser ya da ilçe ara" aria-label="Eser ya da ilçe ara" value={q} onChange={(e) => set({ q: e.target.value })} />
        <span className="muted small-note">
          Klavye: <kbd>J</kbd>/<kbd>K</kbd> eser · <kbd>1</kbd>–<kbd>9</kbd> aday · <kbd>Enter</kbd> kabul
        </span>
      </div>

      {error ? <p className="error">Kuyruk alınamadı: {message(error)}</p> : null}
      {isLoading ? <p className="muted">Yükleniyor…</p> : null}

      {data ? (
        <div className="match">
          <ul className="queue" aria-label={`${STATE_LABEL[state]} eserler`}>
            {list.length === 0 ? <li className="muted" style={{ padding: 12 }}>Bu süzgeçte eser yok.</li> : null}
            {list.map((w) => {
              const cs = data.byWork.get(w.id) ?? [];
              const best = cs.find((c) => !c.vetoed);
              return (
                <li key={w.id}>
                  <button className={w.id === work?.id ? 'active' : ''} aria-current={w.id === work?.id} onClick={() => set({ work: w.slug })}>
                    <span className="queue-name">{tr(w.name)}</span>
                    <span className="queue-meta">
                      {w.district ?? 'İlçe yok'} · {PRECISION_LABEL[w.location_precision]} · {cs.length} aday
                    </span>
                    {best ? (
                      <span className="meter" aria-label={`En iyi aday puanı yüzde ${Math.round(best.score * 100)}`}>
                        <span style={{ width: `${Math.round(best.score * 100)}%` }} />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {work ? (
            <>
              <section className="stack match-detail" aria-label="Eser ve harita">
                <div className="row">
                  <div className="grow">
                    <h2>{tr(work.name)}</h2>
                    <span className="muted">
                      {work.district ?? 'İlçe kitapta yok'} · şu anki konum: {PRECISION_LABEL[work.location_precision]}
                    </span>
                  </div>
                  <Link className="btn outline small" to={`/eserler/${work.slug}`}>
                    Eseri düzenle
                  </Link>
                </div>
                <CandidatesMap workId={work.id} current={current} candidates={candidates} selectedId={selected} fallbackCenter={CITY_CENTER[city] ?? CITY_CENTER.bursa!} onSelect={setSelected} />
                <div className="row legend" aria-label="Harita açıklaması">
                  <span>
                    <span className="ring" /> Şu anki konum
                  </span>
                  {(['wikidata', 'osm', 'nominatim', 'override', 'current'] as const).map((s) => (
                    <span key={s}>
                      <span className="dot" style={{ background: SOURCE_COLOR[s] }} /> {SOURCE_LABEL[s]}
                    </span>
                  ))}
                  <span>
                    <span className="dot hollow" /> Çelişkili
                  </span>
                </div>
              </section>

              <aside className="cands" aria-label="Adaylar">
                {candidates.length === 0 ? (
                  <div className="card stack">
                    <strong>Aday bulunamadı</strong>
                    <p className="muted" style={{ margin: 0 }}>
                      Hiçbir kaynakta bu ada benzeyen yapı yok. Kitaptaki adresle konumu eser sayfasında elle girebilirsiniz.
                    </p>
                    <Link className="btn outline small" to={`/eserler/${work.slug}`} style={{ justifySelf: 'start' }}>
                      Konumu elle gir
                    </Link>
                  </div>
                ) : null}
                {candidates.map((c, i) => (
                  <CandidateCard
                    key={c.id}
                    n={i + 1}
                    c={c}
                    current={current}
                    selected={c.id === selected}
                    busy={busy}
                    onSelect={() => setSelected(c.id)}
                    onAccept={() => accept(c)}
                    onReject={() => void decide(() => setCandidateStatus([c.id], 'rejected'))}
                    onUndo={() => void decide(() => setCandidateStatus(candidates.filter((x) => x.status !== 'pending').map((x) => x.id), 'pending'))}
                    typeName={typeName}
                  />
                ))}
                {candidates.some((c) => c.status === 'pending') ? (
                  <div className="card stack">
                    <strong>Hiçbiri doğru değil</strong>
                    <label className="check">
                      <input type="checkbox" checked={clearLocation} onChange={(e) => setClearLocation(e.target.checked)} disabled={!current} />
                      <span>Eserin şu anki konumunu da kaldır (yanlış olduğu biliniyorsa)</span>
                    </label>
                    <button className="btn danger small" style={{ justifySelf: 'start' }} disabled={busy} onClick={() => void decide(() => rejectAll(work.id, clearLocation))}>
                      Tüm adayları reddet
                    </button>
                  </div>
                ) : null}
                {err ? (
                  <p role="alert" className="error" style={{ margin: 0 }}>
                    {err}
                  </p>
                ) : null}
              </aside>
            </>
          ) : (
            <p className="muted">Eser seçin.</p>
          )}
        </div>
      ) : null}
    </>
  );
}

function CandidateCard({
  n,
  c,
  current,
  selected,
  busy,
  onSelect,
  onAccept,
  onReject,
  onUndo,
  typeName,
}: {
  n: number;
  c: Candidate;
  current: [number, number] | null;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  typeName: (slug: string | null | undefined) => string;
}) {
  const r = c.reasons ?? {};
  const pct = Math.round(c.score * 100);
  const url = sourceUrl(c);
  const away = current ? distanceM(current, [c.lng, c.lat]) : null;
  const type = r.type;
  const district = r.district;
  return (
    <article className={`card cand${selected ? ' selected' : ''}${c.status === 'rejected' ? ' dimmed' : ''}`} onClick={onSelect} aria-label={`Aday ${n}: ${c.label ?? c.ref}`}>
      <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
        <span className={`badge${c.vetoed ? ' hollow' : ''}`} style={c.vetoed ? { color: SOURCE_COLOR[c.source], borderColor: SOURCE_COLOR[c.source] } : { background: SOURCE_COLOR[c.source] }} aria-hidden>
          {n}
        </span>
        <strong className="grow" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {c.label ?? c.ref}
        </strong>
        <span className="pill">{SOURCE_LABEL[c.source]}</span>
      </div>

      <div className="row" style={{ gap: 8 }}>
        <span className="meter grow" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        <span className="num" aria-label={`Puan yüzde ${pct}`}>
          %{pct}
        </span>
      </div>

      <ul className="reasons" aria-label="Gerekçeler">
        {typeof r.name === 'number' ? <li>Ad benzerliği %{Math.round(r.name * 100)}</li> : null}
        {type && (type.work || type.candidate) ? (
          <li className={type.ok === false ? 'bad' : type.ok ? 'good' : ''}>
            {type.ok === false ? '✗' : type.ok ? '✓' : '–'} Tür: {typeName(type.candidate)}
            {type.ok === false ? ` (eser: ${typeName(type.work)})` : ''}
          </li>
        ) : null}
        {district ? (
          <li className={district.inside === false ? 'bad' : district.inside ? 'good' : ''}>
            {district.inside === false ? `✗ ${district.name} ilçesinin dışında` : district.inside ? `✓ ${district.name} içinde` : `– İlçe sınırı bulunamadı`}
          </li>
        ) : null}
        {r.agree && r.agree.length > 0 ? <li className="good">✓ Uyuşan kaynak: {r.agree.map((s) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL] ?? s).join(', ')}</li> : null}
        {r.curated ? <li className="good">✓ Masa başı OSM doğrulaması</li> : null}
        {r.current ? <li>Şu anki konumun kaynağı</li> : null}
        {r.unverified ? <li className="bad">Güven puanı ölçülmemiş</li> : null}
        <li>Düzey: {LEVEL_LABEL[c.level]}</li>
        {away !== null ? <li>Şu anki konuma {formatDistance(away)}</li> : null}
      </ul>

      {c.vetoed ? <p className="muted small-note" style={{ margin: 0 }}>Çelişkili: tür ya da ilçe tutmuyor.</p> : null}

      <div className="row" style={{ gap: 8 }}>
        {c.status === 'pending' ? (
          <>
            <button className="btn small" disabled={busy} onClick={(e) => (e.stopPropagation(), onAccept())}>
              Kabul et
            </button>
            <button className="btn outline small" disabled={busy} onClick={(e) => (e.stopPropagation(), onReject())}>
              Reddet
            </button>
          </>
        ) : (
          <>
            <span className={`pill ${c.status === 'accepted' ? 'verified' : 'archived'}`}>{c.status === 'accepted' ? 'Kabul edildi' : 'Reddedildi'}</span>
            <button className="btn ghost small" disabled={busy} onClick={(e) => (e.stopPropagation(), onUndo())} title="Bu eserin kararlarını beklemeye alır; konum, kabul edilen adayda kalır">
              Kararı geri al
            </button>
          </>
        )}
        {url ? (
          <a className="btn ghost small" href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            Kaynağı aç ↗
          </a>
        ) : null}
      </div>
    </article>
  );
}
