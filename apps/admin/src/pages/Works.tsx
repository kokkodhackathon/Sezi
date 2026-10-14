import { useNavigate, useSearchParams } from 'react-router';

import { mediaUrl, PAGE_SIZE, PRECISION_LABEL, STATUS_LABEL, tr, useLookups, useWorkList, type WorkFilters } from '../lib/data';

const KEYS: (keyof WorkFilters)[] = ['q', 'city', 'type', 'status', 'precision', 'review', 'photo'];

/** Eser listesi: süzgeçler adres çubuğunda tutulur (geri dönüşte kaybolmaz, bağlantı paylaşılabilir). */
export function Works() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const f: WorkFilters = {
    q: params.get('q') ?? '',
    city: params.get('city') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? '',
    precision: params.get('precision') ?? '',
    review: params.get('review') ?? '',
    photo: params.get('photo') ?? '',
    page: Number(params.get('page') ?? 0),
  };
  const set = (key: keyof WorkFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };
  const { data, isFetching, error } = useWorkList(f);
  const { data: lookups } = useLookups();
  const pages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;
  const active = KEYS.some((k) => f[k]);

  return (
    <>
      <div className="row">
        <h1 className="grow">Eserler</h1>
        <span className="muted num" aria-live="polite">
          {isFetching ? 'Yükleniyor…' : `${data?.count ?? 0} eser`}
        </span>
      </div>

      <div className="filters">
        <label className="field">
          Ara
          <input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Eser adı" />
        </label>
        <label className="field">
          İl
          <select value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Tümü</option>
            {lookups?.cities.map((c) => (
              <option key={c.id} value={c.slug}>
                {tr(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Tür
          <select value={f.type} onChange={(e) => set('type', e.target.value)}>
            <option value="">Tümü</option>
            {lookups?.types.map((t) => (
              <option key={t.id} value={t.slug}>
                {tr(t.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Durum
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Tümü</option>
            <option value="draft">Taslak</option>
            <option value="verified">Doğrulandı</option>
            <option value="archived">Arşivde</option>
          </select>
        </label>
        <label className="field">
          Konum
          <select value={f.precision} onChange={(e) => set('precision', e.target.value)}>
            <option value="">Tümü</option>
            <option value="exact">Kesin</option>
            <option value="approximate">Yaklaşık</option>
            <option value="unknown">Yok</option>
          </select>
        </label>
        <label className="field">
          Fotoğraf
          <select value={f.photo} onChange={(e) => set('photo', e.target.value)}>
            <option value="">Tümü</option>
            <option value="with">Var</option>
            <option value="without">Yok</option>
          </select>
        </label>
        <label className="field">
          İnceleme
          <select value={f.review} onChange={(e) => set('review', e.target.value)}>
            <option value="">Tümü</option>
            <option value="1">İnceleme bekleyen</option>
          </select>
        </label>
      </div>
      {active ? (
        <div>
          <button className="btn ghost small" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Süzgeçleri temizle
          </button>
        </div>
      ) : null}

      {error ? <p className="error">Liste alınamadı: {(error as Error).message}</p> : null}

      <table className="table">
        <thead>
          <tr>
            <th aria-label="Fotoğraf" />
            <th>Ad</th>
            <th>Tür</th>
            <th>Yer</th>
            <th>Kaynak</th>
            <th>Konum</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>
          {data?.rows.map((w) => {
            const inv = w.sources.find((s) => s.kind === 'inventory');
            const photo = w.photos[0];
            return (
              <tr key={w.id} className="click" onClick={() => navigate(`/eserler/${w.slug}`)}>
                <td>{photo ? <img className="thumb" src={mediaUrl(photo.thumb ?? photo.path)} alt="" loading="lazy" /> : <div className="thumb" />}</td>
                <td>
                  <a
                    href={`/eserler/${w.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`/eserler/${w.slug}`);
                    }}
                    style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>
                    {tr(w.name)}
                  </a>
                  {w.photos.length > 1 ? <span className="muted"> · {w.photos.length} fotoğraf</span> : null}
                </td>
                <td>{tr(w.type_name)}</td>
                <td>{[w.district, tr(w.city_name)].filter(Boolean).join(', ')}</td>
                <td className="num muted">{inv?.page ? `${inv.volume ? `C${inv.volume} ` : ''}s. ${inv.page}` : '—'}</td>
                <td>
                  <span className={`pill ${w.location_precision === 'unknown' ? 'warn' : ''}`}>{PRECISION_LABEL[w.location_precision]}</span>
                </td>
                <td>
                  <span className={`pill ${w.status}`}>{STATUS_LABEL[w.status]}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="row">
        <button className="btn outline small" disabled={f.page === 0} onClick={() => set('page', String(f.page - 1))}>
          Önceki
        </button>
        <span className="muted num">
          Sayfa {f.page + 1} / {pages}
        </span>
        <button className="btn outline small" disabled={f.page + 1 >= pages} onClick={() => set('page', String(f.page + 1))}>
          Sonraki
        </button>
      </div>
    </>
  );
}
