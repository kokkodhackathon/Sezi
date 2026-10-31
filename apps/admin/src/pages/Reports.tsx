import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { Check, CircleAlert, ExternalLink, Flag, MapPin, RotateCcw, Route, X, ZoomIn } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { SegmentMap } from '@/components/SegmentMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mediaUrl, REPORT_EFFECT, REPORT_LABEL, useReports, type ReportRow, type ReportStatus } from '@/lib/data';
import { PILOT_AREAS, segmentGeometry } from '@/lib/pilot';
import { supabase } from '@/lib/supabase';

type ReportItem = ReportRow & { photo_path?: string | null };

const TABS: { key: ReportStatus; label: string; emptyTitle: string; emptyHint: string }[] = [
  {
    key: 'pending',
    label: 'Bekliyor',
    emptyTitle: 'Bekleyen bildirim yok',
    emptyHint: 'Kullanıcılardan gelen yeni erişilebilirlik bildirimleri incelenmek üzere burada listelenir.',
  },
  {
    key: 'approved',
    label: 'Onaylandı',
    emptyTitle: 'Onaylanan bildirim yok',
    emptyHint: 'Onayladığınız bildirimler rota hesabında yol parçası kısıtı olarak uygulanır.',
  },
  {
    key: 'rejected',
    label: 'Reddedildi',
    emptyTitle: 'Reddedilen bildirim yok',
    emptyHint: 'Geçersiz ya da tekrara düşen bildirimler burada tutulur.',
  },
];

const STATUS_BADGE: Record<ReportStatus, { label: string; variant: 'warning' | 'success' | 'outline' }> = {
  pending: { label: 'Bekliyor', variant: 'warning' },
  approved: { label: 'Onaylandı', variant: 'success' },
  rejected: { label: 'Reddedildi', variant: 'outline' },
};
function isReportStatus(value: string | null): value is ReportStatus {
  return value === 'pending' || value === 'approved' || value === 'rejected';
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Erişilebilirlik bildirimi moderasyonu. Onaylanan bildirim, veritabanında segment_overrides tablosuna yazılır;
 * uygulama rota hesaplarken bu yol parçasından kaçınır (ya da onu merdivenli/dar sayar).
 */
export function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string; subtitle: string } | null>(null);
  const tabParam = searchParams.get('tab');
  const tab = isReportStatus(tabParam) ? tabParam : 'pending';
  const { data, isLoading, error, refetch } = useReports(tab);
  const { data: approvedHistory } = useReports('approved', 5, tab === 'pending');
  const { data: rejectedHistory } = useReports('rejected', 5, tab === 'pending');
  const qc = useQueryClient();

  const changeTab = (next: ReportStatus) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params, { replace: true });
    setSelected(null);
  };

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReportStatus }) => {
      const { error: e } = await supabase.from('a11y_reports').update({ status }).eq('id', id);
      if (e) throw e;
      return status;
    },
    onSuccess: (status) => {
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        status === 'approved'
          ? 'Bildirim onaylandı ve rota kurallarına eklendi.'
          : status === 'rejected'
            ? 'Bildirim reddedildi.'
            : 'Bildirim yeniden beklemeye alındı.',
      );
    },
    onError: (e) => {
      toast.error(`İşlem başarısız: ${e.message}`);
    },
  });

  const rows = (data ?? []) as ReportItem[];
  const current = rows.find((r) => r.id === selected) ?? rows[0];
  const area = current?.area ? PILOT_AREAS[current.area] : undefined;
  const activeTabMeta = TABS.find((t) => t.key === tab) ?? TABS[0]!;
  const recentDecisions = [...(approvedHistory ?? []), ...(rejectedHistory ?? [])]
    .sort((a, b) => Date.parse(b.reviewed_at ?? b.created_at) - Date.parse(a.reviewed_at ?? a.created_at))
    .slice(0, 5);

  return (
    <>
      <PageHeader />

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isReportStatus(value)) changeTab(value);
        }}
      >
        <TabsList aria-label="Bildirim durumu">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              <span>{t.label}</span>
              {tab === t.key && !isLoading ? (
                <Badge variant="secondary" className="num">
                  {rows.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Bildirimler alınamadı</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <Empty className="min-h-0 flex-none border bg-card py-4">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Flag />
            </EmptyMedia>
            <EmptyTitle>{activeTabMeta.emptyTitle}</EmptyTitle>
            <EmptyDescription>{activeTabMeta.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <div className="flex flex-col gap-4" role="list" aria-label="Bildirim listesi">
            {rows.map((r) => (
              <ReportCard
                key={r.id}
                r={r}
                active={current?.id === r.id}
                onSelect={() => setSelected(r.id)}
                onReview={(status) => review.mutate({ id: r.id, status })}
                onPreviewPhoto={(url) =>
                  setPreviewPhoto({
                    url,
                    title: REPORT_LABEL[r.type],
                    subtitle: `${r.area ? (PILOT_AREAS[r.area]?.name.tr ?? r.area) : 'Bölge yok'} · ${fmt(r.created_at)}`,
                  })
                }
                busy={review.isPending && review.variables?.id === r.id}
              />
            ))}
          </div>

          <div className="sticky top-6 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Bildirilen yol parçası</CardTitle>
                <CardDescription>
                  {current
                    ? `${current.area ? (PILOT_AREAS[current.area]?.name.tr ?? current.area) : 'Bölge yok'} · Yol parçası ${current.segment_key ?? '—'}`
                    : 'Haritada görmek için bir bildirim seçin.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SegmentMap
                  line={segmentGeometry(current?.area ?? null, current?.segment_key ?? null)}
                  center={area?.center ?? [29.0613, 40.1842]}
                />
              </CardContent>
              {current ? (
                <CardFooter className="flex-col items-start gap-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{REPORT_LABEL[current.type]}</span>
                  <span>{REPORT_EFFECT[current.type]}</span>
                </CardFooter>
              ) : null}
            </Card>
          </div>
        </div>
      )}
      {tab === 'pending' && rows.length === 0 && recentDecisions.length > 0 ? (
        <section aria-labelledby="recent-reports-heading" className="flex flex-col gap-3">
          <h2 id="recent-reports-heading" className="text-sm font-semibold">Son sonuçlanan bildirimler</h2>
          <ul className="divide-y rounded-xl border bg-card px-4">
            {recentDecisions.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {report.area ? `${PILOT_AREAS[report.area]?.name.tr ?? report.area} · ` : ''}
                    {report.segment_key ?? 'Yol parçası belirtilmemiş'}
                  </p>
                  <p className="text-sm text-muted-foreground">{fmt(report.reviewed_at ?? report.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={STATUS_BADGE[report.status].variant}>{STATUS_BADGE[report.status].label}</Badge>
                  <Link
                    to={`/bildirimler?tab=${report.status}`}
                    className="inline-flex min-h-12 items-center text-sm text-primary underline underline-offset-4"
                  >
                    Bildirimleri gör
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={previewPhoto !== null} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewPhoto?.title ?? 'Bildirim fotoğrafı'}</DialogTitle>
            <DialogDescription>{previewPhoto?.subtitle}</DialogDescription>
          </DialogHeader>
          {previewPhoto ? (
            <img
              src={previewPhoto.url}
              alt={previewPhoto.title}
              className="max-h-[70vh] w-full rounded-lg bg-muted object-contain"
            />
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" size="sm">
                Kapat
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReportCard({
  r,
  active,
  onSelect,
  onReview,
  onPreviewPhoto,
  busy,
}: {
  r: ReportItem;
  active: boolean;
  onSelect: () => void;
  onReview: (s: ReportStatus) => void;
  onPreviewPhoto: (url: string) => void;
  busy: boolean;
}) {
  const areaName = r.area ? (PILOT_AREAS[r.area]?.name.tr ?? r.area) : 'Bölge yok';
  const badge = STATUS_BADGE[r.status];
  const photoUrl = r.photo_path ? (r.photo_path.startsWith('http') ? r.photo_path : mediaUrl(r.photo_path)) : null;

  return (
    <Card
      role="listitem"
      tabIndex={0}
      aria-label={`${REPORT_LABEL[r.type]} — ${areaName}, ${fmt(r.created_at)}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'cursor-pointer transition-colors hover:bg-muted/25',
        active && 'ring-2 ring-primary',
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{REPORT_LABEL[r.type]}</CardTitle>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <CardDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden />
            {areaName} · yol parçası {r.segment_key ?? '—'}
          </span>
          {r.work_slug ? (
            <>
              <span>·</span>
              <Link
                to={`/eserler/${r.work_slug}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4 hover:text-primary-foreground"
              >
                Bildirildiği eser
                <ExternalLink className="size-3" aria-hidden />
              </Link>
            </>
          ) : null}
        </CardDescription>
        <CardAction>
          <span className="num text-xs text-muted-foreground">{fmt(r.created_at)}</span>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Route className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
          <span>{REPORT_EFFECT[r.type]}</span>
        </div>

        {r.note ? (
          <blockquote className="border-l-2 pl-3 text-sm text-foreground">“{r.note}”</blockquote>
        ) : (
          <p className="text-sm text-muted-foreground">Kullanıcı notu eklenmemiş.</p>
        )}

        {photoUrl ? (
          <div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreviewPhoto(photoUrl);
              }}
              className="group relative overflow-hidden rounded-lg border bg-muted"
              aria-label="Bildirim fotoğrafını büyüt"
            >
              <img src={photoUrl} alt={REPORT_LABEL[r.type]} loading="lazy" className="aspect-4/3 h-28 object-cover" />
              <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-0.5 text-xs font-medium text-foreground">
                <ZoomIn className="size-3" aria-hidden />
                Büyüt
              </span>
            </button>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {r.status !== 'approved' ? (
          <Button size="sm" disabled={busy} onClick={() => onReview('approved')}>
            {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
            Onayla
          </Button>
        ) : null}

        {r.status !== 'rejected' ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={busy}>
                <X data-icon="inline-start" />
                Reddet
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bildirim reddedilsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  “{REPORT_LABEL[r.type]}” bildirimi reddedilenler arasına alınacak ve rota hesabına uygulanmayacak.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={() => onReview('rejected')}>
                  Reddet
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        {r.status !== 'pending' ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => onReview('pending')}>
            <RotateCcw data-icon="inline-start" />
            Beklemeye al
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
