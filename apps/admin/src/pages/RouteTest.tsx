import { formatDistance, walkingSpeed, type LngLat } from '@sezi/shared';
import { Fragment, useMemo, useState } from 'react';

import { RouteTestMap } from '../components/RouteTestMap';
import { pilotPlanner } from '../lib/pilot';
import { PROFILE_KEYS, PROFILE_LABEL, PROFILE_LINE, PROFILE_WHY, profileFor, useRouteTest, type LogKind, type ProfileKey, type ProfileRoute, type RouteTestState } from '../lib/route-test';
import { AUDIO_BASE } from '../lib/supabase';

const SPEEDS = [1, 3, 8, 20];

const NOTE: Record<NonNullable<RouteTestState['note']>, string> = {
  need_start: 'Başlangıç seçin: listeden bir başlangıç noktası ya da haritadan bir yer.',
  outside_pilot: 'Seçilen yer pilot alanın (Ulu Cami ve Hanlar Bölgesi) dışında; rota yalnızca burada çizilir.',
  no_route: 'Bu profil için bu esere yol bulunamadı (kapalı yol, merdiven ya da bağlantısız grafik).',
  no_points: 'Yakında yayında anlatım noktası yok; gezinti oluşturulamadı.',
};

const LOG_LABEL: Record<LogKind, string> = {
  step: 'Talimat',
  point: 'Nokta',
  reroute: 'Yeni rota',
  blocked: 'Senaryo',
  detour: 'Senaryo',
  arrive: 'Varış',
  info: 'Bilgi',
};

const minutes = (m: number, mps: number) => Math.max(1, Math.round(m / mps / 60));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/**
 * Rota testi: uygulamadaki planlayıcı ve sanal yürüyüş, telefona gerek kalmadan.
 * Noktalar sayfasında yapılan değişiklik (taslak dahil) burada hemen denenebilir.
 */
export function RouteTest() {
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const { test, state, points, overrides, isLoading, error } = useRouteTest(includeDrafts);
  const [picking, setPicking] = useState(false);

  const starts = pilotPlanner.startPoints();
  const works = useMemo(() => [...pilotPlanner.pilotWorks].sort((a, b) => (a.name?.tr ?? '').localeCompare(b.name?.tr ?? '', 'tr')), []);
  const plan = state.plan;
  const order = useMemo(() => new Map((plan?.via.pointIds ?? []).map((id, i) => [id, i + 1])), [plan]);
  const fired = useMemo(() => new Set(state.fired), [state.fired]);
  const blockedLines = useMemo(
    () => [...state.blocked, ...overrides.filter((o) => o.type === 'construction' || o.type === 'ramp_blocked').map((o) => o.segment_key)].flatMap((id) => {
      const c = pilotPlanner.segmentCoords(id);
      return c ? [c] : [];
    }),
    [state.blocked, overrides],
  );
  const profileMps = walkingSpeed(profileFor(state.profile, state.lang));
  const stats = plan ? pilotPlanner.routeStats(plan) : null;
  const total = plan ? plan.geometry.nodeAtM.at(-1)! : 0;
  const openPoint = state.openPoint ? points.find((p) => p.id === state.openPoint) : undefined;
  const selectedStart = state.start?.kind === 'point' ? state.start.id : null;
  const pickedStart = state.start?.kind === 'pick' ? state.start.location : null;
  const active = state.phase === 'active';
  const planning = state.phase === 'plan';
  const current = plan && state.stepIndex >= 0 ? plan.steps[state.stepIndex] : undefined;

  // Profil karşılaştırması yalnızca plan aşamasında; plan, başlangıç, hedef, dil ya da nokta değişince yeniden hesaplanır.
  const [comparing, setComparing] = useState(false);
  const rows = useMemo(
    () => (comparing && planning ? test.compareProfiles() : null),
    // state.plan: replan her değişiklikte yeni plan üretir (başlangıç, hedef, dil, noktalar, bildirimler).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparing, planning, state.plan, state.start, state.dest, state.lang, test],
  );
  const compareLines = useMemo(
    () => (rows ? rows.flatMap((r) => (r.plan ? [{ key: r.key, line: r.plan.geometry.line, selected: r.key === state.profile }] : [])) : null),
    [rows, state.profile],
  );

  const pick = (p: LngLat) => {
    if (!planning) return;
    setPicking(false);
    test.setStart({ kind: 'pick', location: p });
  };

  return (
    <>
      <div className="row">
        <div className="grow">
          <h1>Rota testi</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            Uygulamadaki rota planlayıcı ve sanal yürüyüş: aynı grafik, aynı noktalar, aynı talimatlar. Telefona gerek kalmadan rota, uğrama noktaları ve senaryolar
            denenir.
          </p>
        </div>
        <label className="check">
          <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} disabled={!planning} />
          <span>
            Taslak noktaları da kullan
            <br />
            <span className="muted">Uygulama yalnızca yayındakileri görür.</span>
          </span>
        </label>
      </div>

      {error ? <p className="error">Noktalar alınamadı: {(error as Error).message}</p> : null}
      {isLoading ? <p className="muted">Noktalar yükleniyor…</p> : null}

      <div className="edit">
        <div className="stack">
          <RouteTestMap
            center={pilotPlanner.center}
            routeLine={plan?.geometry.line ?? null}
            walkedM={state.distance}
            detourLine={state.detourLine}
            blockedLines={blockedLines}
            starts={starts}
            works={works}
            points={points}
            order={order}
            fired={fired}
            selectedStart={selectedStart}
            pickedStart={pickedStart}
            dest={state.dest}
            position={state.position}
            picking={picking}
            onPick={pick}
            onStart={(id) => planning && test.setStart({ kind: 'point', id })}
            onDest={(slug) => planning && test.setDest(slug)}
            compare={compareLines}
          />
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {rows
              ? 'Her profilin rotası kendi çizgisiyle; seçili profil öne çıkar. Çizgi örnekleri aşağıdaki tabloda.'
              : 'Turkuaz çizgi kalan rota, gri kısmı yürünen yol; kesikli kırmızı kapalı yol, kesikli sarı yanlış dönüş. Numaralı daireler rotanın uğradığı noktalar, gri olanlar açılmış noktalar.'}
          </p>

          {/* Karşılaştırma açıkken tablo haritanın hemen altında; tek profilin talimatları gizlenir. */}
          {rows ? <CompareTable rows={rows} selected={state.profile} onSelect={(k) => test.setProfile(k)} /> : null}
          {plan && !rows ? <Steps plan={plan} stepIndex={state.stepIndex} /> : null}
        </div>

        <div className="stack">
          <section className="card stack" aria-labelledby="rt-plan">
            <h2 id="rt-plan">Rota</h2>
            <div className="pair">
              <label className="field">
                Profil
                <select value={state.profile} onChange={(e) => test.setProfile(e.target.value as ProfileKey)} disabled={!planning}>
                  {(Object.keys(PROFILE_LABEL) as ProfileKey[]).map((k) => (
                    <option key={k} value={k}>
                      {PROFILE_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Talimat dili
                <select value={state.lang} onChange={(e) => test.setLang(e.target.value as 'tr' | 'en')} disabled={!planning}>
                  <option value="tr">Türkçe</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="stack" style={{ gap: 8 }}>
              <span className="label">Nereden</span>
              <div className="row" style={{ gap: 8 }} role="group" aria-label="Başlangıç">
                {starts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`btn small${selectedStart === s.id ? '' : ' outline'}`}
                    aria-pressed={selectedStart === s.id}
                    disabled={!planning}
                    onClick={() => test.setStart({ kind: 'point', id: s.id })}
                  >
                    {s.name.tr}
                  </button>
                ))}
                <button type="button" className={`btn small${picking || pickedStart ? '' : ' outline'}`} aria-pressed={picking} disabled={!planning} onClick={() => setPicking(!picking)}>
                  {picking ? 'Haritaya tıklayın…' : pickedStart ? 'Haritadan seçildi' : 'Haritadan seç'}
                </button>
              </div>
              {starts.length === 0 ? <span className="muted">Yayında başlangıç noktası yok; haritadan seçin ya da Noktalar sayfasında ekleyin.</span> : null}
            </div>

            <label className="field">
              Nereye
              <select value={state.dest ?? ''} onChange={(e) => test.setDest(e.target.value || null)} disabled={!planning}>
                <option value="">Gezinti (hedefsiz, yakındaki anlatım noktaları)</option>
                {works.map((w) => (
                  <option key={w.workSlug} value={w.workSlug}>
                    {w.name?.tr}
                  </option>
                ))}
              </select>
            </label>

            {state.note ? <p className="muted" style={{ margin: 0 }}>{NOTE[state.note]}</p> : null}

            <label className="check">
              <input type="checkbox" checked={comparing} onChange={(e) => setComparing(e.target.checked)} disabled={!planning} />
              <span>
                Profilleri karşılaştır
                <br />
                <span className="muted">Aynı başlangıç ve hedef için dört profilin rotası haritada ve tabloda.</span>
              </span>
            </label>

            {plan && stats ? (
              <>
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill">
                    {formatDistance(stats.lengthM, 'tr')} · ~{minutes(stats.lengthM, profileMps)} dk
                  </span>
                  <span className="pill">{stats.stairs === 0 ? 'Basamaksız' : `${stats.stairs} basamaklı geçiş`}</span>
                  {stats.busyM > 0 ? <span className="pill">Ana cadde {stats.busyM} m</span> : null}
                  {stats.cobbleM > 0 ? <span className="pill">Arnavut kaldırımı {stats.cobbleM} m</span> : null}
                  <span className="pill">{plan.steps.length} talimat</span>
                  {plan.via.pointIds.length ? (
                    <span className="pill verified">
                      {plan.via.pointIds.length} noktaya uğrar{plan.via.extraM > 0 ? ` · +${plan.via.extraM} m` : ''}
                    </span>
                  ) : null}
                  {plan.arrival ? <span className="pill verified">Varış bilgisi var</span> : plan.kind === 'work' ? <span className="pill warn">Varış bilgisi yok</span> : null}
                </div>
                {plan.via.pointIds.length ? (
                  <ol style={{ margin: 0, paddingLeft: 22 }}>
                    {plan.via.pointIds.map((id, i) => {
                      const p = points.find((x) => x.id === id);
                      return (
                        <li key={id} style={{ color: fired.has(id) ? 'var(--muted)' : undefined }}>
                          {p?.title.tr ?? id} <span className="muted num">· {Math.round(plan.via.atM[i]!)} m</span>
                          {p?.audio.tr || p?.audio.en ? <span className="muted"> · sesli</span> : null}
                          {fired.has(id) ? <span className="muted"> · açıldı</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="card stack" aria-labelledby="rt-sim">
            <h2 id="rt-sim">Simülasyon</h2>
            <div className="row" style={{ gap: 8 }}>
              {planning ? (
                <button className="btn" disabled={!plan} onClick={() => test.begin()}>
                  {state.dest ? 'Yürüyüşü başlat' : 'Gezintiye başla'}
                </button>
              ) : (
                <>
                  {active ? (
                    <button className="btn outline" onClick={() => (state.running ? test.pause() : test.resume())}>
                      {state.running ? 'Duraklat' : 'Devam et'}
                    </button>
                  ) : null}
                  <button className="btn danger" onClick={() => test.stop()}>
                    {active ? 'Yürüyüşü bitir' : 'Plana dön'}
                  </button>
                </>
              )}
            </div>

            <div className="stack" style={{ gap: 6 }}>
              <span className="label">Hız</span>
              <div className="row" style={{ gap: 8 }} role="group" aria-label="Simülasyon hızı">
                {SPEEDS.map((v) => (
                  <button key={v} type="button" className={`btn small${state.speed === v ? '' : ' outline'}`} aria-pressed={state.speed === v} onClick={() => test.setSpeed(v)}>
                    {v}×
                  </button>
                ))}
              </div>
            </div>

            <div className="stack" style={{ gap: 6 }}>
              <span className="label">Senaryolar</span>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn small outline" disabled={!active} onClick={() => test.blockAhead()}>
                  Önümüzdeki yol kapandı
                </button>
                <button className="btn small outline" disabled={!active || state.detouring} onClick={() => test.wrongTurn()}>
                  Yanlış dönüş
                </button>
              </div>
            </div>

            <label className="check">
              <input type="checkbox" checked={state.voice} onChange={(e) => test.setVoice(e.target.checked)} />
              <span>
                Sesli oku
                <br />
                <span className="muted">Talimatlar tarayıcı sesiyle, noktalar kayıtla (yoksa metinden). Duymayan profilde ses yok.</span>
              </span>
            </label>

            {!planning ? (
              <div className="stack" style={{ gap: 6 }} aria-live="polite">
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill num">
                    {Math.round(state.distance)} / {Math.round(total)} m
                  </span>
                  <span className="pill num">{clock(state.elapsedS)}</span>
                  {state.reroutes ? <span className="pill warn">{state.reroutes} yeni rota</span> : null}
                  {state.blocked.length ? <span className="pill warn">{state.blocked.length} kapalı yol</span> : null}
                  {state.phase === 'arrived' ? <span className="pill verified">Vardı</span> : null}
                </div>
                {current ? (
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                    <span className="muted" style={{ fontSize: 13, display: 'block', fontWeight: 600 }}>
                      Şu anki talimat ({state.stepIndex + 1}/{plan!.steps.length})
                    </span>
                    {current.text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {openPoint ? (
            <section className="card stack" aria-labelledby="rt-point" style={{ borderLeft: '4px solid var(--accent)' }}>
              <div className="row">
                <h2 id="rt-point" className="grow">
                  {openPoint.title[state.lang] ?? openPoint.title.tr}
                </h2>
                <button className="btn ghost small" onClick={() => test.closePoint()}>
                  Kapat
                </button>
              </div>
              {openPoint.body ? <p style={{ margin: 0 }}>{openPoint.body[state.lang] ?? openPoint.body.tr}</p> : <p className="muted">Metin yok.</p>}
              {openPoint.audio.tr || openPoint.audio.en ? (
                <audio controls preload="none" src={AUDIO_BASE + (state.lang === 'en' ? (openPoint.audio.en ?? openPoint.audio.tr) : (openPoint.audio.tr ?? openPoint.audio.en))} aria-label="Nokta ses kaydı" />
              ) : (
                <span className="muted">Ses kaydı yok; uygulama metni seslendirir.</span>
              )}
            </section>
          ) : null}

          <section className="card stack" aria-labelledby="rt-log">
            <h2 id="rt-log">Kayıt</h2>
            {state.log.length === 0 ? <p className="muted" style={{ margin: 0 }}>Yürüyüş başlayınca talimatlar, açılan noktalar ve yeni rotalar burada sıralanır.</p> : null}
            <ol className="picklist" style={{ maxHeight: 320 }} aria-live="polite">
              {state.log.map((e) => (
                <li key={e.id} style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)' }}>
                  <span className="muted num">{clock(e.t)} · </span>
                  <strong>{LOG_LABEL[e.kind]}:</strong> {e.text}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

/** Rotanın tüm talimatları: yürürken o anki talimat vurgulanır. */
function Steps({ plan, stepIndex }: { plan: NonNullable<RouteTestState['plan']>; stepIndex: number }) {
  return (
    <section aria-labelledby="rt-steps" className="stack" style={{ gap: 8 }}>
      <h2 id="rt-steps">Talimatlar</h2>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Yer</th>
            <th scope="col">Talimat</th>
            <th scope="col">Tür</th>
          </tr>
        </thead>
        <tbody>
          {plan.steps.map((s, i) => (
            <tr key={`${s.nodeId}-${i}`} aria-current={i === stepIndex ? 'step' : undefined} style={i === stepIndex ? { background: '#DCEFEE' } : i < stepIndex ? { color: 'var(--muted)' } : undefined}>
              <td className="num">{i + 1}</td>
              <td className="num">{Math.round(s.atM)} m</td>
              <td>{s.text}</td>
              <td className="muted">{s.kind ?? s.turn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Haritadaki çizginin küçük örneği: profil, renk yanında kalınlık ve kesiklikle de tanınır. */
function LineSwatch({ k }: { k: ProfileKey }) {
  const s = PROFILE_LINE[k];
  const w = Math.min(s.width, 8);
  return (
    <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true" style={{ flex: 'none' }}>
      <line x1="2" y1="6" x2="38" y2="6" stroke={s.color} strokeWidth={w} strokeLinecap={s.dash ? 'butt' : 'round'} strokeDasharray={s.dash ? s.dash.map((d) => d * w).join(' ') : undefined} />
    </svg>
  );
}

/**
 * Aynı başlangıç ve hedef için dört profilin rotası yan yana. En kısa rotaya göre fark, aynı çıkan rotalar ve
 * profilin rotayı neden değiştirdiği yazılır; "Bu profil" ile simülasyonun profili seçilir.
 */
function CompareTable({ rows, selected, onSelect }: { rows: ProfileRoute[]; selected: ProfileKey; onSelect: (k: ProfileKey) => void }) {
  if (rows.length === 0) return <p className="muted">Karşılaştırma için pilot alanda bir başlangıç seçin.</p>;
  const lengths = rows.flatMap((r) => (r.stats ? [r.stats.lengthM] : []));
  const shortest = lengths.length ? Math.min(...lengths) : 0;
  const sig = (r: ProfileRoute) => r.plan?.route.segmentIds.join(',') ?? '';
  /** Aynı rotayı çizen ilk profil (aynıysa "… ile aynı rota" yazılır). */
  const sameAs = (r: ProfileRoute) => (r.plan ? rows.find((o) => o !== r && o.plan && sig(o) === sig(r) && PROFILE_KEYS.indexOf(o.key) < PROFILE_KEYS.indexOf(r.key)) : undefined);
  return (
    <section aria-labelledby="rt-compare" className="stack" style={{ gap: 8 }}>
      <h2 id="rt-compare">Profil karşılaştırması</h2>
      <div style={{ overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Profil</th>
            <th scope="col">Uzunluk · süre</th>
            <th scope="col">Basamak</th>
            <th scope="col">Ana cadde · zemin</th>
            <th scope="col">Uğrama</th>
            <th scope="col">
              <span className="sr-only">Seçim</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const same = sameAs(r);
            const diff = r.stats ? Math.round(r.stats.lengthM - shortest) : 0;
            const bg = r.key === selected ? { background: '#DCEFEE' } : undefined;
            return (
              <Fragment key={r.key}>
              <tr aria-current={r.key === selected ? 'true' : undefined} style={bg}>
                <td>
                  <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <LineSwatch k={r.key} />
                    <strong>{PROFILE_LABEL[r.key]}</strong>
                  </div>
                </td>
                {r.plan && r.stats ? (
                  <>
                    <td className="num">
                      {formatDistance(r.stats.lengthM, 'tr')} · ~{r.minutes} dk
                      <div className="muted" style={{ fontSize: 13 }}>
                        {diff === 0 ? 'En kısa' : `+${diff} m`} · {r.plan.steps.length} talimat
                      </div>
                    </td>
                    <td className="num">{r.stats.stairs === 0 ? 'Yok' : r.stats.stairs}</td>
                    <td className="num">
                      Cadde {r.stats.busyM} m
                      <div className="muted" style={{ fontSize: 13 }}>Arnavut {r.stats.cobbleM} m</div>
                    </td>
                    <td className="num">
                      {r.plan.via.pointIds.length} nokta
                      <div className="muted" style={{ fontSize: 13 }}>{r.plan.via.extraM > 0 ? `+${r.plan.via.extraM} m` : r.plan.via.pointIds.length ? 'yol üstünde' : ''}</div>
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="muted">
                    Bu profil için rota bulunamadı.
                  </td>
                )}
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" className={`btn small${r.key === selected ? '' : ' outline'}`} aria-pressed={r.key === selected} onClick={() => onSelect(r.key)}>
                    {r.key === selected ? 'Seçili' : 'Bu profil'}
                  </button>
                </td>
              </tr>
              <tr style={bg}>
                <td colSpan={6} className="muted" style={{ fontSize: 13, borderTop: 'none', paddingTop: 0 }}>
                  {PROFILE_LINE[r.key].style} · {PROFILE_WHY[r.key]}
                  {same ? ` ${PROFILE_LABEL[same.key]} ile aynı rota.` : ''}
                </td>
              </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Seçili profilin çizgisi haritada öne çıkar; simülasyon bu profille yürür.
      </p>
    </section>
  );
}
