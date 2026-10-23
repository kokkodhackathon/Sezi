import { formatDistance, planTour, profileFor, toTours, walkingSpeed, type PlannedTour, type Tour } from '@sezi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CircleAlert, Footprints, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { localized, slugify, STATUS_LABEL, tr, useLookups, useToursAdmin, type Status, type TourAdminRow } from '@/lib/data';
import { PILOT_CITY, pilotPlanner } from '@/lib/pilot';
import { usePilotPlanner } from '@/lib/route-test';
import { supabase } from '@/lib/supabase';

type DialogState = { mode: 'create' } | { mode: 'edit'; tour: TourAdminRow } | null;

const WALKER = profileFor('walker', 'tr');
const WHEELCHAIR = profileFor('wheelchair', 'tr');
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_STOPS = 12;
const STATUSES: Status[] = ['draft', 'verified', 'archived'];

/** Pilot alandaki eserler (durak seçenekleri), Türkçe ada göre. */
const PILOT_WORKS = pilotPlanner.pilotWorks
  .map((n) => ({ slug: n.workSlug!, name: n.name?.tr ?? n.workSlug!, type: n.workType ?? '' }))
  .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
const WORK_NAME = new Map(PILOT_WORKS.map((w) => [w.slug, w.name]));
const workName = (slug: string) => WORK_NAME.get(slug) ?? slug;

interface Summary {
  walker: PlannedTour | null;
  wheelchair: PlannedTour | null;
  /** Tekerlekli sandalyeyle ulaşılamayan (ya da grafikte olmayan) duraklar. */
  wheelchairSkipped: string[];
}

/** Mobil uygulamayla aynı hesap: varsayılan başlangıçtan yürüyen ve tekerlekli sandalye planı. */
function summarize(tour: Tour): Summary {
  const from = pilotPlanner.defaultStart();
  const walker = planTour(pilotPlanner, tour, WALKER, from);
  const wheelchair = planTour(pilotPlanner, tour, WHEELCHAIR, from);
  const reached = new Set(wheelchair?.stops.map((s) => s.slug));
  return { walker, wheelchair, wheelchairSkipped: tour.stops.filter((s) => !reached.has(s)) };
}

const minutes = (m: number) => Math.max(1, Math.round(m / walkingSpeed(WALKER) / 60));

function walkerText(p: PlannedTour) {
  return [`${p.stops.length} durak`, formatDistance(p.lengthM, 'tr'), `~${minutes(p.lengthM)} dk`, p.stairs > 0 ? `${p.stairs} basamaklı geçiş` : null]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Turlar: pilot alandaki hazır turlar veridir (kodda tur yok). Sıra varsayılan olarak uygulamada en yakın
 * duraktan hesaplanır; istenirse sabitlenir. Yayındaki turlar mobil uygulamada ve web sitesinde görünür.
 */
export function Tours() {
  const { data, isLoading, error, refetch } = useToursAdmin(PILOT_CITY);
  const lookups = useLookups();
  // Mesafeler uygulamayla aynı başlangıçtan hesaplansın: noktalar planlayıcıya uygulanmadan tablo gösterilmez.
  const planner = usePilotPlanner(false);
  const version = planner.version;
  const problem = error ?? planner.error;
  const [dialog, setDialog] = useState<DialogState>(null);

  const cityId = lookups.data?.cities.find((c) => c.slug === PILOT_CITY)?.id;
  const typeName = useMemo(() => new Map((lookups.data?.types ?? []).map((t) => [t.slug, tr(t.name)])), [lookups.data]);

  const rows = useMemo(() => {
    void version; // planlayıcıya noktalar uygulanınca yeniden hesaplanır
    return (data ?? []).map((row) => ({ row, summary: summarize(toTours([row])[0]!) }));
  }, [data, version]);

  const nextOrder = data ? Math.max(0, ...data.map((t) => t.sort_order)) + 1 : 1;

  return (
    <>
      <PageHeader
        actions={
          data && cityId && planner.ready ? (
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus data-icon="inline-start" />
              Yeni tur
            </Button>
          ) : null
        }
      />

      {problem ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Turlar alınamadı</AlertTitle>
          <AlertDescription>
            {problem.message}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading || (!problem && !planner.ready) ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : data && data.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Footprints />
            </EmptyMedia>
            <EmptyTitle>Henüz tur yok</EmptyTitle>
            <EmptyDescription>Pilot alandaki eserlerden bir tur oluşturun; yayına aldığınızda uygulamada görünür.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data && planner.ready ? (
        <Card>
          <CardHeader>
            <CardTitle>Pilot alan turları</CardTitle>
            <CardDescription>
              Mesafeler uygulamanın varsayılan başlangıç noktasından, mobil uygulamayla aynı rota motoruyla hesaplanır. Yalnızca yayındaki turlar
              uygulamada görünür.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tur</TableHead>
                  <TableHead className="text-right">Durak</TableHead>
                  <TableHead>Yürüyen</TableHead>
                  <TableHead>Tekerlekli sandalye</TableHead>
                  <TableHead>Sıra</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ row, summary }) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{tr(row.title)}</span>
                        <span className="text-xs text-muted-foreground">{row.slug}</span>
                      </div>
                    </TableCell>
                    <TableCell className="num text-right">
                      {summary.walker?.stops.length ?? 0}/{row.stops.length}
                    </TableCell>
                    <TableCell className="num text-muted-foreground">
                      {summary.walker ? `${formatDistance(summary.walker.lengthM, 'tr')} · ~${minutes(summary.walker.lengthM)} dk` : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-muted-foreground">{summary.wheelchair ? formatDistance(summary.wheelchair.lengthM, 'tr') : '—'}</span>
                        {summary.wheelchairSkipped.length > 0 ? <Badge variant="warning">{summary.wheelchairSkipped.length} durak atlanıyor</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.fixed_order ? 'Sabit' : 'Otomatik'}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="icon-sm" aria-label={`${tr(row.title)} turunu düzenle`} onClick={() => setDialog({ mode: 'edit', tour: row })}>
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {dialog && cityId ? (
        <TourFormDialog
          key={dialog.mode === 'edit' ? dialog.tour.id : 'create'}
          state={dialog}
          cityId={cityId}
          nextOrder={nextOrder}
          typeName={typeName}
          version={version}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

interface Problems {
  title?: string;
  slug?: string;
  stops?: string;
  order?: string;
}

function TourFormDialog({
  state,
  cityId,
  nextOrder,
  typeName,
  version,
  onClose,
}: {
  state: NonNullable<DialogState>;
  cityId: string;
  nextOrder: number;
  typeName: Map<string, string>;
  version: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = state.mode === 'edit' ? state.tour : null;

  const [title, setTitle] = useState({ tr: editing?.title.tr ?? '', en: editing?.title.en ?? '' });
  const [body, setBody] = useState({ tr: editing?.body?.tr ?? '', en: editing?.body?.en ?? '' });
  const [slug, setSlug] = useState(editing?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!editing);
  const [sortOrder, setSortOrder] = useState(String(editing?.sort_order ?? nextOrder));
  const [status, setStatus] = useState<Status>(editing?.status ?? 'draft');
  const [stops, setStops] = useState<string[]>(editing?.stops ?? []);
  const [fixedOrder, setFixedOrder] = useState(editing?.fixed_order ?? false);
  const [problems, setProblems] = useState<Problems>({});

  // Önizleme yalnız durak listesine ve sıra kipine bağlıdır (başlık ve kısa ad planı etkilemez).
  const summary = useMemo(() => {
    void version; // planlayıcıya noktalar uygulanınca yeniden hesaplanır
    if (stops.length === 0) return null;
    return summarize({ slug: 'onizleme', citySlug: PILOT_CITY, title: { tr: '' }, body: null, stops, fixedOrder, sortOrder: 0 });
  }, [stops, fixedOrder, version]);

  /** Otomatik sırada liste uygulamanın hesapladığı sıradır; ulaşılamayan duraklar sona eklenir. */
  const shown = useMemo(() => {
    if (fixedOrder || !summary?.walker) return stops;
    const planned = summary.walker.stops.map((s) => s.slug);
    return [...planned, ...stops.filter((s) => !planned.includes(s))];
  }, [stops, fixedOrder, summary]);

  const toggleStop = (s: string) => setStops((list) => (list.includes(s) ? list.filter((x) => x !== s) : [...list, s]));
  const move = (i: number, d: -1 | 1) =>
    setStops((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
  const setFixed = (on: boolean) => {
    // Sabitlenince başlangıç sırası, o an uygulamanın hesapladığı sıradır.
    if (on) setStops(shown);
    setFixedOrder(on);
  };

  const onTitle = (v: string) => {
    setTitle({ ...title, tr: v });
    if (!slugTouched) setSlug(slugify(v));
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...(editing ? { id: editing.id } : {}),
        slug,
        city_id: editing?.city_id ?? cityId,
        title: localized(title),
        body: localized(body),
        stops,
        fixed_order: fixedOrder,
        sort_order: Number(sortOrder.trim() || nextOrder),
        status,
      };
      const { error } = await supabase.from('tours').upsert(payload);
      if (error) throw error.code === '23505' ? new Error('Bu kısa ad başka bir turda kullanılıyor.') : new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tours'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? `${title.tr.trim()} kaydedildi.` : `${title.tr.trim()} turu eklendi.`);
      onClose();
    },
    onError: (e) => {
      toast.error(`Tur kaydedilemedi: ${e.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tours').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tours'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Tur silindi.');
      onClose();
    },
    onError: (e) => {
      toast.error(`Tur silinemedi: ${e.message}`);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p: Problems = {};
    if (!title.tr.trim()) p.title = 'Türkçe başlık zorunlu.';
    if (!SLUG_RE.test(slug)) p.slug = 'Kısa ad yalnız küçük harf, rakam ve tire içerebilir.';
    if (stops.length < 2 || stops.length > MAX_STOPS) p.stops = `Turda 2–${MAX_STOPS} durak olmalı.`;
    const ord = Number(sortOrder.trim() || nextOrder);
    if (!Number.isInteger(ord) || ord < 0) p.order = 'Sıra geçerli bir tam sayı olmalı.';
    setProblems(p);
    if (p.title || p.slug || p.stops || p.order) return;
    save.mutate();
  };

  const busy = save.isPending || remove.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `${tr(editing.title)} turunu düzenle` : 'Yeni tur'}</DialogTitle>
          <DialogDescription>
            Açıklamaya kaynaksız tarihî bilgi yazmayın; durakları ve turun neyi gösterdiğini anlatmak yeterli.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!problems.title || undefined}>
                <FieldLabel htmlFor="tour-title-tr">Başlık (TR) *</FieldLabel>
                <Input id="tour-title-tr" value={title.tr} aria-invalid={!!problems.title || undefined} onChange={(e) => onTitle(e.target.value)} placeholder="Örn. Hanlar yolu" />
                {problems.title ? <FieldError>{problems.title}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="tour-title-en">Başlık (EN)</FieldLabel>
                <Input id="tour-title-en" value={title.en} onChange={(e) => setTitle({ ...title, en: e.target.value })} placeholder="Örn. The inns route" />
                <FieldDescription>Boş bırakılırsa Türkçe başlık kullanılır.</FieldDescription>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="tour-body-tr">Açıklama (TR)</FieldLabel>
                <Textarea id="tour-body-tr" rows={3} value={body.tr} onChange={(e) => setBody({ ...body, tr: e.target.value })} />
              </Field>
              <Field>
                <FieldLabel htmlFor="tour-body-en">Açıklama (EN)</FieldLabel>
                <Textarea id="tour-body-en" rows={3} value={body.en} onChange={(e) => setBody({ ...body, en: e.target.value })} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={!!problems.slug || undefined}>
                <FieldLabel htmlFor="tour-slug">Kısa ad</FieldLabel>
                <Input
                  id="tour-slug"
                  value={slug}
                  disabled={!!editing}
                  aria-invalid={!!problems.slug || undefined}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
                {problems.slug ? <FieldError>{problems.slug}</FieldError> : <FieldDescription>Web adresi: /turlar/{slug || '…'}</FieldDescription>}
              </Field>
              <Field data-invalid={!!problems.order || undefined}>
                <FieldLabel htmlFor="tour-order">Listede sıra</FieldLabel>
                <Input id="tour-order" inputMode="numeric" value={sortOrder} aria-invalid={!!problems.order || undefined} onChange={(e) => setSortOrder(e.target.value)} />
                {problems.order ? <FieldError>{problems.order}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="tour-status">Durum</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(STATUSES.find((s) => s === v) ?? 'draft')}>
                  <SelectTrigger id="tour-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STATUSES.map((k) => (
                        <SelectItem key={k} value={k}>
                          {STATUS_LABEL[k]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <FieldSet data-invalid={!!problems.stops || undefined}>
              <FieldLegend variant="label">Duraklar ({stops.length})</FieldLegend>
              <FieldDescription>Pilot alandaki eserler. Seçtiğiniz eserler tura durak olarak girer.</FieldDescription>
              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                {PILOT_WORKS.map((w) => {
                  const id = `tour-stop-${w.slug}`;
                  return (
                    <div key={w.slug} className="flex min-h-10 items-center gap-2 rounded-md px-2">
                      <Checkbox id={id} checked={stops.includes(w.slug)} onCheckedChange={() => toggleStop(w.slug)} />
                      <Label htmlFor={id} className="flex flex-1 cursor-pointer flex-col items-start gap-0 font-normal">
                        <span>{w.name}</span>
                        <span className="text-xs text-muted-foreground">{typeName.get(w.type) ?? w.type}</span>
                      </Label>
                    </div>
                  );
                })}
              </div>
              {problems.stops ? <FieldError>{problems.stops}</FieldError> : null}
            </FieldSet>

            <Field orientation="horizontal" className="items-center justify-between rounded-lg border p-3">
              <FieldContent>
                <FieldLabel htmlFor="tour-fixed">Sırayı ben belirleyeceğim</FieldLabel>
                <FieldDescription>
                  Kapalıyken uygulama durakları başlangıç noktasından en yakın duraktan başlayarak sıralar. Açıkken aşağıdaki sıra korunur.
                </FieldDescription>
              </FieldContent>
              <Switch id="tour-fixed" checked={fixedOrder} onCheckedChange={setFixed} />
            </Field>

            {shown.length > 0 ? (
              <ol className="flex flex-col gap-1 rounded-lg border p-2" aria-label="Durak sırası">
                {shown.map((s, i) => (
                  <li key={s} className="flex min-h-10 items-center gap-2 px-2">
                    <span className="num w-6 text-right text-muted-foreground">{i + 1}.</span>
                    <span className="flex-1">{workName(s)}</span>
                    {fixedOrder ? (
                      <>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`${workName(s)}: yukarı taşı`} disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`${workName(s)}: aşağı taşı`}
                          disabled={i === shown.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                      </>
                    ) : null}
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`${workName(s)}: turdan çıkar`} onClick={() => toggleStop(s)}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ol>
            ) : null}

            {summary ? (
              <div className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
                <p>
                  <span className="font-medium">Yürüyen: </span>
                  <span className="num">{summary.walker ? walkerText(summary.walker) : 'Planlanamadı'}</span>
                </p>
                <p>
                  <span className="font-medium">Tekerlekli sandalye: </span>
                  <span className="num">
                    {summary.wheelchair ? `${summary.wheelchair.stops.length} durak · ${formatDistance(summary.wheelchair.lengthM, 'tr')}` : 'Planlanamadı'}
                  </span>
                </p>
                {summary.wheelchairSkipped.length > 0 ? (
                  <Alert>
                    <CircleAlert />
                    <AlertTitle>Tekerlekli sandalyede atlanan duraklar</AlertTitle>
                    <AlertDescription>{summary.wheelchairSkipped.map(workName).join(', ')}</AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </FieldGroup>

          <DialogFooter className="sm:justify-between">
            {editing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={busy}>
                    <Trash2 data-icon="inline-start" />
                    Sil
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tur silinsin mi?</AlertDialogTitle>
                    <AlertDialogDescription>“{tr(editing.title)}” turu kalıcı olarak silinecek. Eserler etkilenmez.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={() => remove.mutate(editing.id)}>
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Vazgeç
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                {editing ? 'Kaydet' : 'Turu ekle'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
