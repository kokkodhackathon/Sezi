import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';

import { SegmentMap } from '../components/SegmentMap';
import { REPORT_EFFECT, REPORT_LABEL, useReports, type ReportRow, type ReportStatus } from '../lib/data';
import { PILOT_AREAS, segmentGeometry } from '../lib/pilot';
import { supabase } from '../lib/supabase';

const TABS: { key: ReportStatus; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'rejected', label: 'Reddedilen' },
];

const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/**
 * Erişilebilirlik bildirimi moderasyonu. Onaylanan bildirim, veritabanında segment_overrides tablosuna yazılır;
 * uygulama rota hesaplarken bu yol parçasından kaçınır (ya da onu merdivenli/dar sayar).
 */
export function Reports() {
  const [tab, setTab] = useState<ReportStatus>('pending');
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, error } = useReports(tab);
  const qc = useQueryClient();
  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReportStatus }) => {
      const { error: e } = await supabase.from('a11y_reports').update({ status }).eq('id', id);
      if (e) throw e;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports'] }),
  });
  const current = data?.find((r) => r.id === selected) ?? data?.[0];
  const area = current?.area ? PILOT_AREAS[current.area] : undefined;

  return (
    <>
      <h1>Erişilebilirlik bildirimleri</h1>
      <div className="row" role="tablist" aria-label="Bildirim durumu">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`btn small ${tab === t.key ? '' : 'outline'}`} onClick={() => { setTab(t.key); setSelected(null); }}>
            {t.label}
          </button>
        ))}
      </div>
      {error ? <p className="error">Bildirimler alınamadı: {(error as Error).message}</p> : null}
      {review.error ? <p className="error">İşlem başarısız: {(review.error as Error).message}</p> : null}

      <div className="edit">
        <div className="stack">
          {isLoading ? <p className="muted">Yükleniyor…</p> : null}
          {!isLoading && data?.length === 0 ? <div className="card muted">Bu durumda bildirim yok.</div> : null}
          {data?.map((r) => (
            <ReportCard key={r.id} r={r} active={current?.id === r.id} onSelect={() => setSelected(r.id)} onReview={(status) => review.mutate({ id: r.id, status })} busy={review.isPending} />
          ))}
        </div>
        <div className="stack" style={{ position: 'sticky', top: 24 }}>
          <SegmentMap line={segmentGeometry(current?.area ?? null, current?.segment_key ?? null)} center={area?.center ?? [29.0613, 40.1842]} />
          {current ? <p className="muted" style={{ margin: 0 }}>{REPORT_EFFECT[current.type]}</p> : null}
        </div>
      </div>
    </>
  );
}

function ReportCard({ r, active, onSelect, onReview, busy }: { r: ReportRow; active: boolean; onSelect: () => void; onReview: (s: ReportStatus) => void; busy: boolean }) {
  return (
    <div className="card" style={{ display: 'grid', gap: 8, outline: active ? '2px solid var(--primary)' : 'none', cursor: 'pointer' }} onClick={onSelect}>
      <div className="row">
        <strong className="grow">{REPORT_LABEL[r.type]}</strong>
        <span className="muted num">{fmt(r.created_at)}</span>
      </div>
      <span className="muted">
        {r.area ? (PILOT_AREAS[r.area]?.name.tr ?? r.area) : 'Bölge yok'} · yol parçası {r.segment_key ?? '—'}
        {r.work_slug ? (
          <>
            {' · '}
            <Link to={`/eserler/${r.work_slug}`} onClick={(e) => e.stopPropagation()}>
              bildirildiği eser
            </Link>
          </>
        ) : null}
      </span>
      {r.note ? <p style={{ margin: 0 }}>“{r.note}”</p> : <p className="muted" style={{ margin: 0 }}>Not yok.</p>}
      <div className="row" style={{ gap: 6 }}>
        {r.status !== 'approved' ? (
          <button className="btn small" disabled={busy} onClick={(e) => { e.stopPropagation(); onReview('approved'); }}>
            Onayla
          </button>
        ) : null}
        {r.status !== 'rejected' ? (
          <button className="btn danger small" disabled={busy} onClick={(e) => { e.stopPropagation(); onReview('rejected'); }}>
            Reddet
          </button>
        ) : null}
        {r.status !== 'pending' ? (
          <button className="btn ghost small" disabled={busy} onClick={(e) => { e.stopPropagation(); onReview('pending'); }}>
            Beklemeye al
          </button>
        ) : null}
      </div>
    </div>
  );
}
