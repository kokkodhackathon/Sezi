import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { searchWorks, slugify, tr, useLookups } from '../lib/data';
import { supabase } from '../lib/supabase';

/**
 * Yeni eser: kimlik bilgileriyle taslak olarak açılır, ayrıntılar düzenleme sayfasında doldurulur.
 * Taslak uygulamada görünmez; "Doğrula ve yayımla" ile yayına çıkar.
 */
export function NewWork() {
  const navigate = useNavigate();
  const { data: lookups } = useLookups();
  const [name, setName] = useState({ tr: '', en: '' });
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [district, setDistrict] = useState('');
  const [problem, setProblem] = useState('');
  const cityRow = lookups?.cities.find((c) => c.id === city);
  // Aynı adla kayıtlı eser varsa uyarı (çift kayıt önlenir).
  const similar = useQuery({
    queryKey: ['similar', name.tr, cityRow?.slug],
    queryFn: () => searchWorks(name.tr, cityRow?.slug),
    enabled: name.tr.trim().length >= 4,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!name.tr.trim()) throw new Error('Türkçe ad zorunlu.');
      if (!city || !type) throw new Error('İl ve tür seçin.');
      const base = slugify(`${cityRow?.slug ?? ''}-${name.tr}`);
      // Kısa ad benzersiz olmalı: doluysa -2, -3 … eklenir.
      const { data: taken } = await supabase.from('works').select('slug').like('slug', `${base}%`);
      const used = new Set((taken ?? []).map((r) => r.slug as string));
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      const { error } = await supabase.from('works').insert({
        slug,
        name: { tr: name.tr.trim(), ...(name.en.trim() ? { en: name.en.trim() } : {}) },
        city_id: city,
        work_type_id: type,
        district: district.trim() || null,
        status: 'draft',
        location_precision: 'unknown',
        needs_review: true,
      });
      if (error) throw error;
      return slug;
    },
    onSuccess: (slug) => navigate(`/eserler/${slug}`),
    onError: (e) => setProblem((e as Error).message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem('');
    create.mutate();
  };

  return (
    <>
      <h1>Yeni eser</h1>
      <form className="card stack" style={{ maxWidth: 720 }} onSubmit={submit} noValidate>
        <p className="muted" style={{ margin: 0 }}>
          Eser taslak olarak açılır ve uygulamada görünmez. Konum, içerik ve fotoğrafları bir sonraki sayfada ekleyip yayımlarsınız.
        </p>
        <div className="pair">
          <label className="field" htmlFor="name-tr">
            Ad (TR) *
            <input id="name-tr" value={name.tr} onChange={(e) => setName({ ...name, tr: e.target.value })} required />
          </label>
          <label className="field" htmlFor="name-en">
            Ad (EN)
            <input id="name-en" value={name.en} onChange={(e) => setName({ ...name, en: e.target.value })} />
          </label>
        </div>
        <div className="pair">
          <label className="field" htmlFor="city">
            İl *
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)} required>
              <option value="">Seçin</option>
              {lookups?.cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {tr(c.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="type">
            Tür *
            <select id="type" value={type} onChange={(e) => setType(e.target.value)} required>
              <option value="">Seçin</option>
              {lookups?.types.map((t) => (
                <option key={t.id} value={t.id}>
                  {tr(t.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field" htmlFor="district">
          İlçe
          <input id="district" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </label>
        {similar.data && similar.data.length > 0 ? (
          <div className="card" style={{ background: 'var(--soft)', boxShadow: 'none' }} role="status">
            <strong>Benzer adlı eserler var:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {similar.data.slice(0, 5).map((w) => (
                <li key={w.id}>
                  <a href={`/eserler/${w.slug}`}>{tr(w.name)}</a> <span className="muted">· {w.district ?? w.city_slug}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {problem ? (
          <p role="alert" className="error" style={{ margin: 0 }}>
            {problem}
          </p>
        ) : null}
        <div className="row">
          <button className="btn" type="submit" disabled={create.isPending}>
            {create.isPending ? 'Oluşturuluyor…' : 'Taslak olarak oluştur'}
          </button>
        </div>
      </form>
    </>
  );
}
