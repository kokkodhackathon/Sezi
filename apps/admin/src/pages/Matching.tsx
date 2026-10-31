import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  MapPinOff,
  Pencil,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { CandidatesMap } from '@/components/CandidatesMap';
import { PageHeader } from '@/components/page-header';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CITY_CENTER, PRECISION_LABEL, tr, useLookups } from '@/lib/data';
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
} from '@/lib/review';

const STATES: QueueState[] = ['pending', 'conflict', 'none', 'decided'];
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
  useEffect(() => {
    if (params.has('state') || isLoading || error || !data || counts.pending > 0) return;
    const nextState = STATES.find((candidateState) => counts[candidateState] > 0);
    if (nextState) set({ state: nextState, work: null });
  }, [counts, data, error, isLoading, params]);

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    return (data?.works ?? [])
      .filter((w) => states.get(w.id) === state)
      .filter((w) => !needle || tr(w.name).toLocaleLowerCase('tr').includes(needle) || (w.district ?? '').toLocaleLowerCase('tr').includes(needle))
      .sort(
        (a, b) =>
          (data?.byWork.get(b.id)?.find((c) => !c.vetoed)?.score ?? 0) -
          (data?.byWork.get(a.id)?.find((c) => !c.vetoed)?.score ?? 0),
      );
  }, [data, states, state, q]);

  const work = data?.works.find((w) => w.slug === slug) ?? list[0] ?? null;
  const candidates = useMemo(() => (work ? (data?.byWork.get(work.id) ?? []) : []), [data, work]);
  const selectedRowRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [work?.id]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [clearLocation, setClearLocation] = useState(false);
  const [shownWork, setShownWork] = useState<string | null>(null);
  const [vetoCandidate, setVetoCandidate] = useState<Candidate | null>(null);

  // Eser değişince ilk vetosuz aday seçilir (render sırasında; efektte değil).
  if ((work?.id ?? null) !== shownWork) {
    setShownWork(work?.id ?? null);
    setSelected(candidates.find((c) => !c.vetoed)?.id ?? candidates[0]?.id ?? null);
    setErr('');
    setClearLocation(false);
    setVetoCandidate(null);
  }

  const go = (delta: number) => {
    if (list.length === 0) return;
    const i = work ? list.findIndex((w) => w.id === work.id) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, i + delta))];
    if (next) set({ work: next.slug });
  };

  /** Karardan sonra listede bir sonraki esere geçilir (karar verilen eser bu süzgeçten çıkar). */
  const decide = async (action: () => Promise<void>, successMessage: string) => {
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
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(successMessage);
      if (state !== 'decided') set({ work: next?.slug ?? null });
    } catch (e) {
      const msg = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const accept = (c: Candidate) => {
    if (!work) return;
    if (c.vetoed) {
      setVetoCandidate(c);
      return;
    }
    void decide(() => acceptCandidate(c), 'Aday kabul edildi ve eserin konumu güncellendi.');
  };

  // Klavye kısayolları (yazı alanındayken ve onay penceresi açıkken devre dışı).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        busy ||
        vetoCandidate ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        t.closest('input, textarea, select, [role="alertdialog"], [role="dialog"]')
      ) {
        return;
      }
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
  const workIndex = work ? list.findIndex((w) => w.id === work.id) : -1;
  const nextNonEmptyState = STATES.find((candidateState) => candidateState !== state && counts[candidateState] > 0);

  return (
    <>
      <PageHeader
        hint="Veri hattı her eser için Wikidata, OpenStreetMap ve önceki eşleşmeden aday önerir. Tür ya da ilçe tutmayan aday çelişkili işaretlenir. Kabul ettiğiniz aday eserin konumu olur."
        actions={
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor="matching-city-select">İl</FieldLabel>
            <Select value={city} onValueChange={(v) => set({ city: v, work: null })}>
              <SelectTrigger id="matching-city-select" className="min-w-40 bg-card">
                <SelectValue placeholder="İl seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cities.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {tr(c.name)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        }
      />

        <p className="text-xs text-muted-foreground">
          Menü rozeti tüm illerde aday durumu bekleyen eserleri sayar; sekmeler seçili ildeki kuyruğu gösterir.
        </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={state} onValueChange={(v) => set({ state: v, work: null })}>
            <TabsList aria-label="Kuyruk">
              {STATES.map((s) => (
                <TabsTrigger key={s} value={s} className="gap-1.5 px-3">
                  <span>{STATE_LABEL[s]}</span>
                  <Badge variant={state === s ? 'default' : 'secondary'} className="num">
                    {counts[s]}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <InputGroup className="w-64 bg-card sm:w-72">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Eser ya da ilçe ara"
              aria-label="Eser ya da ilçe ara"
              value={q}
              onChange={(e) => set({ q: e.target.value })}
            />
            {q ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton onClick={() => set({ q: null })} aria-label="Aramayı temizle">
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Klavye:</span>
          <KbdGroup>
            <Kbd>J</Kbd>
            <span>/</span>
            <Kbd>K</Kbd>
          </KbdGroup>
          <span>eser ·</span>
          <KbdGroup>
            <Kbd>1</Kbd>
            <span>–</span>
            <Kbd>9</Kbd>
          </KbdGroup>
          <span>aday ·</span>
          <Kbd>Enter</Kbd>
          <span>kabul</span>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Kuyruk alınamadı</AlertTitle>
          <AlertDescription>{typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error)}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <Skeleton className="h-[560px] rounded-xl" />
          <Skeleton className="h-[560px] rounded-xl" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <Card className="flex flex-col py-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden">
            <CardHeader className="border-b px-3 pb-2.5">
              <CardTitle className="text-sm">{STATE_LABEL[state]} eserler</CardTitle>
              <CardDescription className="num text-xs">
                {list.length} eser {workIndex >= 0 ? `· ${workIndex + 1} / ${list.length}` : ''}
              </CardDescription>
              <CardAction className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={workIndex <= 0}
                  onClick={() => go(-1)}
                  aria-label="Önceki eser (K)"
                  title="Önceki eser (K)"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={workIndex < 0 || workIndex >= list.length - 1}
                  onClick={() => go(1)}
                  aria-label="Sonraki eser (J)"
                  title="Sonraki eser (J)"
                >
                  <ChevronRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="min-h-0 px-2 lg:flex-1">
              {list.length === 0 ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyTitle>Bu süzgeçte eser yok</EmptyTitle>
                    <EmptyDescription>Başka bir sekme seçin ya da arama terimini değiştirin.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)] min-h-[380px] lg:h-full lg:min-h-0">
                  <ul aria-label={`${STATE_LABEL[state]} eserler`} className="flex flex-col gap-1 pr-2">
                    {list.map((w) => {
                      const cs = data.byWork.get(w.id) ?? [];
                      const best = cs.find((c) => !c.vetoed);
                      const isSelected = w.id === work?.id;
                      const bestPct = best ? Math.round(best.score * 100) : null;
                      return (
                        <li key={w.id}>
                          <button
                            ref={isSelected ? selectedRowRef : undefined}
                            type="button"
                            aria-current={isSelected}
                            onClick={() => set({ work: w.slug })}
                            className={cn(
                              'flex min-h-12 w-full flex-col gap-1.5 rounded-lg border-l-4 px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'border-l-primary-foreground bg-primary/25 font-bold text-foreground'
                                : 'border-l-transparent hover:bg-muted/70',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={cn('text-sm leading-snug break-words', isSelected ? 'font-bold' : 'font-semibold')}>
                                {tr(w.name)}
                              </span>
                              {isSelected ? (
                                <Badge variant="default" className="shrink-0">
                                  Seçili
                                </Badge>
                              ) : null}
                            </div>
                            <span className="text-xs font-normal text-muted-foreground">
                              {w.district ?? 'İlçe yok'} · {PRECISION_LABEL[w.location_precision]} · {cs.length} aday
                            </span>
                            {bestPct !== null ? (
                              <div className="flex items-center gap-3">
                                <Progress
                                  value={bestPct}
                                  aria-label={`En iyi aday puanı yüzde ${bestPct}`}
                                  className="h-1.5 flex-1"
                                />
                                <span className="num text-[11px] font-medium text-muted-foreground">%{bestPct}</span>
                              </div>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {work ? (
            <>
              <Card className="xl:sticky xl:top-4" aria-label="Eser ve harita">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-extrabold">{tr(work.name)}</CardTitle>
                    <Badge variant="secondary">{typeName(work.type_slug)}</Badge>
                  </div>
                  <CardDescription>
                    {work.district ?? 'İlçe kitapta yok'} · şu anki konum: {PRECISION_LABEL[work.location_precision]}
                  </CardDescription>
                  <CardAction>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/eserler/${work.slug}`}>
                        <Pencil data-icon="inline-start" />
                        Eseri düzenle
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <CandidatesMap
                    workId={work.id}
                    current={current}
                    candidates={candidates}
                    selectedId={selected}
                    fallbackCenter={CITY_CENTER[city] ?? CITY_CENTER.bursa!}
                    onSelect={setSelected}
                  />
                </CardContent>
                <CardFooter className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Harita açıklaması">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-3.5 rounded-full border-[3px] border-destructive" aria-hidden />
                    Şu anki konum
                  </span>
                  {(['wikidata', 'osm', 'nominatim', 'override', 'current'] as const).map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5">
                      <span className="inline-block size-3 rounded-full" style={{ background: SOURCE_COLOR[s] }} aria-hidden />
                      {SOURCE_LABEL[s]}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block size-3 rounded-full border-2 border-muted-foreground bg-card" aria-hidden />
                    Çelişkili (içi boş)
                  </span>
                </CardFooter>
              </Card>

              <aside className="flex flex-col gap-3 lg:col-span-2 xl:col-span-1" aria-label="Adaylar">
                {err ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>İşlem tamamlanamadı</AlertTitle>
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                ) : null}

                {candidates.length === 0 ? (
                  <Card>
                    <CardContent>
                      <Empty className="py-6">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <MapPinOff />
                          </EmptyMedia>
                          <EmptyTitle>Aday bulunamadı</EmptyTitle>
                          <EmptyDescription>
                            Hiçbir kaynakta bu ada benzeyen yapı yok. Kitaptaki adresle konumu eser sayfasında elle girebilirsiniz.
                          </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/eserler/${work.slug}`}>Konumu elle gir</Link>
                          </Button>
                        </EmptyContent>
                      </Empty>
                    </CardContent>
                  </Card>
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
                    onReject={() => void decide(() => setCandidateStatus([c.id], 'rejected'), 'Aday reddedildi.')}
                    onUndo={() =>
                      void decide(
                        () =>
                          setCandidateStatus(
                            candidates.filter((x) => x.status !== 'pending').map((x) => x.id),
                            'pending',
                          ),
                        'Eserin aday kararları beklemeye alındı.',
                      )
                    }
                    typeName={typeName}
                  />
                ))}

                {candidates.some((c) => c.status === 'pending') ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Hiçbiri doğru değil</CardTitle>
                      <CardDescription>Önerilen adayların hiçbiri bu esere ait değilse tümünü reddedin.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Field orientation="horizontal">
                        <Checkbox
                          id="clear-work-location"
                          checked={clearLocation}
                          disabled={!current}
                          onCheckedChange={(v) => setClearLocation(v === true)}
                        />
                        <FieldLabel htmlFor="clear-work-location" className="font-normal">
                          Eserin şu anki konumunu da kaldır (yanlış olduğu biliniyorsa)
                        </FieldLabel>
                      </Field>
                    </CardContent>
                    <CardFooter>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={busy}>
                            {busy ? <Spinner data-icon="inline-start" /> : <X data-icon="inline-start" />}
                            Tüm adayları reddet
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Tüm adaylar reddedilsin mi?</AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{tr(work.name)}</strong> için bekleyen tüm konum adayları reddedilecek
                              {clearLocation ? ' ve eserin mevcut konumu kaldırılacak' : ''}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() =>
                                void decide(
                                  () => rejectAll(work.id, clearLocation),
                                  clearLocation ? 'Tüm adaylar reddedildi ve mevcut konum kaldırıldı.' : 'Tüm adaylar reddedildi.',
                                )
                              }
                            >
                              Tümünü reddet
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardFooter>
                  </Card>
                ) : null}
              </aside>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 py-4 text-sm text-muted-foreground lg:col-span-1 xl:col-span-2">
              <span>Bu sekmede incelenecek eser yok.</span>
              {nextNonEmptyState ? (
                <Link
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                  to={`/eslestirme?${new URLSearchParams({ city, state: nextNonEmptyState })}`}
                >
                  {STATE_LABEL[nextNonEmptyState]} sekmesine geç
                </Link>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <AlertDialog open={vetoCandidate !== null} onOpenChange={(open) => !open && setVetoCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çelişkili aday kabul edilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{vetoCandidate?.label ?? vetoCandidate?.ref}</strong> adayı tür ya da ilçe bakımından kitap kaydıyla çelişkili
              işaretlenmiş. Yine de <strong>{work ? tr(work.name) : ''}</strong> eserinin konumu yapılsın mı?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = vetoCandidate;
                setVetoCandidate(null);
                if (target) {
                  void decide(() => acceptCandidate(target), 'Aday kabul edildi ve eserin konumu güncellendi.');
                }
              }}
            >
              Yine de kabul et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <Card
      role="region"
      aria-label={`Aday ${n}: ${c.label ?? c.ref}`}
      onClick={onSelect}
      className={cn(
        'cursor-pointer transition-colors',
        selected ? 'bg-primary/10 ring-2 ring-ring' : 'hover:bg-muted/40',
        c.status === 'rejected' && 'opacity-65',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'num inline-grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold',
              c.vetoed ? 'bg-card' : 'text-card',
            )}
            style={
              c.vetoed
                ? { color: SOURCE_COLOR[c.source], borderColor: SOURCE_COLOR[c.source] }
                : { background: SOURCE_COLOR[c.source], borderColor: SOURCE_COLOR[c.source] }
            }
            aria-hidden
          >
            {n}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <CardTitle className="text-sm leading-snug break-words">{c.label ?? c.ref}</CardTitle>
              {selected ? <Badge variant="default">Seçili</Badge> : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{SOURCE_LABEL[c.source]}</Badge>
              {n <= 9 ? <Kbd title={`Klavyeden ${n} tuşuyla seçilir`}>{n}</Kbd> : null}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Progress value={pct} aria-label={`Puan yüzde ${pct}`} className="h-2 flex-1" />
          <Badge variant={pct >= 75 ? 'success' : pct >= 50 ? 'secondary' : 'warning'} className="num">
            %{pct}
          </Badge>
        </div>

        <ul className="flex flex-wrap gap-1.5" aria-label="Gerekçeler">
          {typeof r.name === 'number' ? (
            <li>
              <Badge variant="secondary" className="num">
                Ad benzerliği %{Math.round(r.name * 100)}
              </Badge>
            </li>
          ) : null}
          {type && (type.work || type.candidate) ? (
            <li>
              <Badge variant={type.ok === false ? 'warning' : type.ok ? 'success' : 'secondary'}>
                {type.ok === false ? <X aria-hidden className="mr-1 inline size-3.5" /> : type.ok ? <Check aria-hidden className="mr-1 inline size-3.5" /> : null}
                Tür: {typeName(type.candidate)}
                {type.ok === false ? ` (eser: ${typeName(type.work)})` : ''}
              </Badge>
            </li>
          ) : null}
          {district ? (
            <li>
              <Badge variant={district.inside === false ? 'warning' : district.inside ? 'success' : 'secondary'}>
                {district.inside === false ? (
                  <>
                    <X aria-hidden className="mr-1 inline size-3.5" />
                    {district.name} ilçesinin dışında
                  </>
                ) : district.inside ? (
                  <>
                    <Check aria-hidden className="mr-1 inline size-3.5" />
                    {district.name} içinde
                  </>
                ) : (
                  '– İlçe sınırı bulunamadı'
                )}
              </Badge>
            </li>
          ) : null}
          {r.agree && r.agree.length > 0 ? (
            <li>
              <Badge variant="success">
                <Check aria-hidden className="mr-1 inline size-3.5" />
                Uyuşan kaynak: {r.agree.map((s) => SOURCE_LABEL[s as keyof typeof SOURCE_LABEL] ?? s).join(', ')}
              </Badge>
            </li>
          ) : null}
          {r.curated ? (
            <li>
              <Badge variant="success"><Check aria-hidden className="mr-1 inline size-3.5" />Masa başı OSM doğrulaması</Badge>
            </li>
          ) : null}
          {r.current ? (
            <li>
              <Badge variant="secondary">Şu anki konumun kaynağı</Badge>
            </li>
          ) : null}
          {r.unverified ? (
            <li>
              <Badge variant="warning"><X aria-hidden className="mr-1 inline size-3.5" />Güven puanı ölçülmemiş</Badge>
            </li>
          ) : null}
          <li>
            <Badge variant="outline">Düzey: {LEVEL_LABEL[c.level]}</Badge>
          </li>
          {away !== null ? (
            <li>
              <Badge variant="outline" className="num">
                Şu anki konuma {formatDistance(away)}
              </Badge>
            </li>
          ) : null}
        </ul>

        {c.vetoed ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
            <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
            <span>Çelişkili: tür ya da ilçe kitap kaydıyla tutmuyor.</span>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2">
        {c.status === 'pending' ? (
          <>
            <Button
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onAccept();
              }}
            >
              {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
              Kabul et
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
            >
              <X data-icon="inline-start" />
              Reddet
            </Button>
          </>
        ) : (
          <>
              {c.status === 'accepted' ? <><Check aria-hidden className="mr-1 inline size-3.5" />Kabul edildi</> : 'Reddedildi'}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onUndo();
              }}
              title="Bu eserin kararlarını beklemeye alır; konum, kabul edilen adayda kalır"
            >
              <RotateCcw data-icon="inline-start" />
              Kararı geri al
            </Button>
          </>
        )}
        {url ? (
          <Button variant="ghost" size="sm" asChild onClick={(e) => e.stopPropagation()} className="ml-auto">
            <a href={url} target="_blank" rel="noreferrer">
              Kaynağı aç
              <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
