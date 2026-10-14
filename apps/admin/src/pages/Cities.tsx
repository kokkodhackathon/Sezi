import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { slugify, tr, useCitiesAdmin, type CityRow } from '../lib/data';
import { supabase } from '../lib/supabase';

const STATUS: Record<NonNullable<CityRow['inventory_status']>, string> = {
  published: 'Yayımlandı',
  printing: 'Baskıda',
  in_progress: 'Çalışma sürüyor',
  planned: 'Planlandı',
};

/**
 * İller: yeni il eklemek kod gerektirmez. Pasif il uygulamada görünmez; eserleri girildikçe yayına alınır.
 */
export function Cities() {
  const { data, isLoading, error } = useCitiesAdmin();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async (c: CityRow) => {
      const { error: e } = await supabase.from('cities').update({ is_active: !c.is_active }).eq('id', c.id);
      if (e) throw e;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cities-admin'] });
      void qc.invalidateQueries({ queryKey: ['lookups'] });
    },
  });

  return (
    <>
      <h1>İller</h1>
      <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>
        Envanter yeni bir ile genişlediğinde buradan eklenir. Uygulamadaki il seçicisinde yalnızca yayındaki iller görünür.
      </p>
      {error ? <p className="error">İller alınamadı: {(error as Error).message}</p> : null}
      {toggle.error ? <p className="error">{(toggle.error as Error).message}</p> : null}
      <table className="table">
        <thead>
          <tr>
            <th>İl</th>
            <th>Envanter</th>
            <th className="num">Kayıtlı eser</th>
            <th>Uygulamada</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={4} className="muted">
                Yükleniyor…
              </td>
            </tr>
          ) : null}
          {data?.cities.map((c) => (
            <tr key={c.id}>
              <td>
                <strong>{tr(c.name)}</strong> <span className="muted">· {c.slug}</span>
              </td>
              <td className="muted">
                {[c.inventory_year, c.inventory_status ? STATUS[c.inventory_status] : null, c.inventory_works ? `${c.inventory_works} eser` : null].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="num">{data.workCount.get(c.slug) ?? 0}</td>
              <td>
                <label className="row" style={{ gap: 8 }}>
                  <input type="checkbox" checked={c.is_active} onChange={() => toggle.mutate(c)} aria-label={`${tr(c.name)} uygulamada görünsün`} />
                  {c.is_active ? 'Yayında' : 'Gizli'}
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data ? <NewCity regions={data.regions} nextOrder={Math.max(0, ...data.cities.map((c) => c.sort_order)) + 1} /> : null}
    </>
  );
}

function NewCity({ regions, nextOrder }: { regions: { id: string; name: { tr: string } }[]; nextOrder: number }) {
  const qc = useQueryClient();
  const [name, setName] = useState({ tr: '', en: '' });
  const [region, setRegion] = useState(regions[0]?.id ?? '');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<keyof typeof STATUS>('planned');
  const [problem, setProblem] = useState('');
  const create = useMutation({
    mutationFn: async () => {
      if (!name.tr.trim()) throw new Error('İl adı zorunlu.');
      const y = year ? Number(year) : null;
      if (y !== null && (!Number.isInteger(y) || y < 2000 || y > 2100)) throw new Error('Envanter yılı 2000–2100 arasında olmalı.');
      const { error } = await supabase.from('cities').insert({
        name: { tr: name.tr.trim(), en: name.en.trim() || name.tr.trim() },
        slug: slugify(name.tr),
        region_id: region,
        is_active: false,
        sort_order: nextOrder,
        inventory_year: y,
        inventory_status: status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName({ tr: '', en: '' });
      setYear('');
      setProblem('');
      void qc.invalidateQueries({ queryKey: ['cities-admin'] });
    },
    onError: (e) => setProblem((e as Error).message),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <form className="card stack" style={{ maxWidth: 720 }} onSubmit={submit} noValidate>
      <h2>Yeni il</h2>
      <div className="pair">
        <label className="field" htmlFor="city-tr">
          Ad (TR) *
          <input id="city-tr" value={name.tr} onChange={(e) => setName({ ...name, tr: e.target.value })} />
        </label>
        <label className="field" htmlFor="city-en">
          Ad (EN)
          <input id="city-en" value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} />
        </label>
      </div>
      <div className="pair">
        <label className="field" htmlFor="region">
          Bölge
          <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {tr(r.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="pair">
          <label className="field" htmlFor="year">
            Envanter yılı
            <input id="year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="field" htmlFor="inv-status">
            Envanter durumu
            <select id="inv-status" value={status} onChange={(e) => setStatus(e.target.value as keyof typeof STATUS)}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="error" style={{ margin: 0 }}>
          {problem}
        </p>
      ) : null}
      <div className="row">
        <button className="btn" type="submit" disabled={create.isPending}>
          {create.isPending ? 'Ekleniyor…' : 'İli ekle (gizli)'}
        </button>
      </div>
    </form>
  );
}
