import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { mediaUrl, searchWorks, tr, useInbox, type InboxPhoto } from '../lib/data';
import { supabase } from '../lib/supabase';

/** Arşiv klasör adından ilçe ipucu: "4-İnegöl Klasörü" → İnegöl. */
function districtHint(folder: string | null): string {
  if (!folder) return '';
  const m = folder.match(/^\d+-(.+?) Klasörü$/);
  return m ? m[1]! : '';
}

/**
 * Fotoğraf kutusu: kitapta eşleşmeyen arşiv fotoğrafları. Admin fotoğrafa bakıp esere bağlar.
 * Bağlanan fotoğraf eserin galerisinin sonuna eklenir; "Bağla ve yayımla" doğrudan uygulamada görünür yapar.
 */
export function Inbox() {
  const { data, isLoading, error } = useInbox();
  const groups = new Map<string, InboxPhoto[]>();
  for (const p of data ?? []) {
    const key = p.folder ?? 'Klasörsüz';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return (
    <>
      <div className="row">
        <h1 className="grow">Fotoğraf kutusu</h1>
        <span className="muted num">{isLoading ? 'Yükleniyor…' : `${data?.length ?? 0} fotoğraf bekliyor`}</span>
      </div>
      <p className="muted" style={{ margin: 0, maxWidth: '70ch' }}>
        Bu fotoğraflar envanter arşivinden geldi ama kitaptaki görsellerle otomatik eşleşmedi. Fotoğrafı büyütüp hangi esere ait olduğunu kitapla karşılaştırarak seçin.
      </p>
      {error ? <p className="error">Liste alınamadı: {(error as Error).message}</p> : null}
      {!isLoading && data?.length === 0 ? <div className="card">Kutuda bekleyen fotoğraf yok.</div> : null}
      {[...groups].map(([folder, photos]) => (
        <section key={folder} className="stack">
          <h2>
            {folder} <span className="muted">({photos.length})</span>
          </h2>
          <div className="photos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {photos.map((p) => (
              <InboxCard key={p.id} photo={p} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function InboxCard({ photo }: { photo: InboxPhoto }) {
  const qc = useQueryClient();
  const [q, setQ] = useState(districtHint(photo.folder));
  const [open, setOpen] = useState(false);
  const results = useQuery({ queryKey: ['work-search', q], queryFn: () => searchWorks(q, 'bursa'), enabled: open });
  const assign = useMutation({
    mutationFn: async ({ workId, name, publish }: { workId: string; name: { tr: string; en?: string }; publish: boolean }) => {
      // Galerinin sonuna: mevcut fotoğraf sayısı kadar sıra.
      const { count } = await supabase.from('media').select('id', { count: 'exact', head: true }).eq('work_id', workId);
      const suffix = photo.kind === 'aerial' ? { tr: ', havadan görünüm', en: ', aerial view' } : photo.kind === 'inscription' ? { tr: ', kitabe', en: ', inscription' } : { tr: '', en: '' };
      const { error } = await supabase
        .from('media')
        .update({
          work_id: workId,
          status: publish ? 'verified' : 'draft',
          sort_order: count ?? 0,
          alt_text: { tr: `${name.tr}${suffix.tr}`, en: `${name.en ?? name.tr}${suffix.en}` },
        })
        .eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['works'] });
    },
  });

  return (
    <div className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
      <a href={mediaUrl(photo.storage_path)} target="_blank" rel="noreferrer" title="Büyük boyutu yeni sekmede aç">
        <img src={mediaUrl(photo.thumb_path ?? photo.storage_path)} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 10, display: 'block' }} />
      </a>
      <span className="muted" style={{ fontSize: 12, wordBreak: 'break-all' }}>
        {photo.source_file?.split('/').pop()}
        {photo.kind === 'aerial' ? ' · havadan' : photo.kind === 'inscription' ? ' · kitabe' : ''}
      </span>
      <label className="field">
        Eser ara
        <input value={q} onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); }} placeholder="Eser adı ya da ilçe" />
      </label>
      {open ? (
        <div style={{ display: 'grid', gap: 4, maxHeight: 220, overflow: 'auto' }}>
          {results.isLoading ? <span className="muted">Aranıyor…</span> : null}
          {results.data?.length === 0 ? <span className="muted">Sonuç yok.</span> : null}
          {results.data?.map((w) => (
            <div key={w.id} className="row" style={{ gap: 6, justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4 }}>
              <span style={{ minWidth: 0 }}>
                <strong>{tr(w.name)}</strong>
                <span className="muted"> · {[tr(w.type_name), w.district].filter(Boolean).join(', ')}</span>
              </span>
              <span className="row" style={{ gap: 4 }}>
                <button className="btn small" disabled={assign.isPending} onClick={() => assign.mutate({ workId: w.id, name: { tr: w.name.tr, en: w.name.en }, publish: true })}>
                  Bağla ve yayımla
                </button>
                <button className="btn ghost small" disabled={assign.isPending} onClick={() => assign.mutate({ workId: w.id, name: { tr: w.name.tr, en: w.name.en }, publish: false })}>
                  Taslak
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {assign.error ? <span className="error">{(assign.error as Error).message}</span> : null}
    </div>
  );
}
