import type { LocalizedText } from '@sezi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  FileText,
  Pencil,
  RotateCcw,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

import { BookPage } from '@/components/book-page';
import { PageHeader } from '@/components/page-header';
import { ArchitectureSuggest, BuiltYearSuggest, SummarySuggest } from '@/components/text-suggestions';
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { localized, tr, useLookups } from '@/lib/data';
import { PILOT_AREAS } from '@/lib/pilot';
import {
  bookPageUrl,
  DRAFT_STATUS_LABEL,
  publishDraft,
  requestSummary,
  setDraftStatus,
  useTextDrafts,
  WARNING_LABEL,
  type DraftStatus,
  type TextDraft,
  renameWorkFromBook,
} from '@/lib/review';

const plain = (s: string) => s.toLocaleLowerCase('tr').replace(/[^\p{L}\p{N}]/gu, '');

/** Kitaptaki başlık uygulamadaki addan farklıysa (içindekiler ayrıştırmasındaki kaymalar) düzeltme önerisi. */
function NameFromBook({ draft }: { draft: TextDraft }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const title = draft.book_title;
  if (!title || plain(title.tr) === plain(draft.work.name.tr)) return null;
  const apply = async () => {
    setBusy(true);
    try {
      await renameWorkFromBook(draft);
      toast.success(`Eserin adı “${title.tr}” oldu.`);
      await queryClient.invalidateQueries({ queryKey: ['text-drafts'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ad değiştirilemedi.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <CardContent className="pt-0">
      <Alert>
        <BookOpen />
        <AlertTitle>Kitaptaki başlık farklı</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <p>
            Uygulamada: <strong>{draft.work.name.tr}</strong>
            <br />
            Kitapta: <strong>{title.tr}</strong>
            {title.en ? <> · EN: <strong>{title.en}</strong></> : null}
          </p>
          <Button variant="outline" size="sm" className="min-h-10 self-start" disabled={busy} onClick={() => void apply()}>
            {busy ? <Spinner /> : <Check data-icon="inline-start" />}
            Adı kitaptakiyle değiştir
          </Button>
        </AlertDescription>
      </Alert>
    </CardContent>
  );
}

type DraftFieldKey = 'address' | 'history' | 'architecture' | 'period' | 'summary';
const FIELDS: { key: DraftFieldKey; label: string; rows: number }[] = [
  { key: 'address', label: 'Adres', rows: 4 },
  { key: 'history', label: 'Tarihçe', rows: 14 },
  { key: 'architecture', label: 'Mimari', rows: 8 },
  { key: 'period', label: 'Dönem', rows: 2 },
  { key: 'summary', label: 'Sade özet', rows: 4 },
];
type Form = Record<DraftFieldKey, { tr: string; en: string }> & { built_year: string; founder: string };
type LangView = 'tr' | 'en' | 'both';

function toForm(d: TextDraft): Form {
  return {
    address: { tr: d.address?.tr ?? '', en: d.address?.en ?? '' },
    history: { tr: d.history?.tr ?? '', en: d.history?.en ?? '' },
    architecture: { tr: d.architecture?.tr ?? '', en: d.architecture?.en ?? '' },
    period: { tr: d.period?.tr ?? '', en: d.period?.en ?? '' },
    summary: { tr: d.summary?.tr ?? '', en: d.summary?.en ?? '' },
    built_year: d.built_year?.toString() ?? '',
    founder: d.founder ?? '',
  };
}

/** Özetin kaynağı: formdaki tarihçe ve mimari metni (henüz yayınlanmamış düzeltmeler dahil), dile göre. */
const summarySourceOf = (f: Form) => ({
  tr: [f.history.tr, f.architecture.tr].filter((s) => s.trim()).join('\n\n'),
  en: [f.history.en, f.architecture.en].filter((s) => s.trim()).join('\n\n'),
});

const STATUSES: DraftStatus[] = ['pending', 'published', 'rejected'];
const PILOT_WORKS = new Set(PILOT_AREAS['bursa-hanlar'].nodes.flatMap((n) => n.workSlug ? [n.workSlug] : []));
const GROUP_LABELS = ['Pilot alan', 'Fotoğraflı eserler', 'Diğer eserler'];
function draftGroup(draft: TextDraft) {
  return PILOT_WORKS.has(draft.work.slug) ? 0 : draft.hasPhotos ? 1 : 2;
}

/**
 * Kitaptan metin taslakları: veri hattı her eserin sayfalarından adres, tarihçe ve mimari metnini (TR/EN) ayırır.
 * Admin kitap sayfasıyla karşılaştırıp düzeltir ve esere yayınlar. Yayınlanan metin uygulamada eser sayfasında görünür.
 */
export function Texts() {
  const [params, setParams] = useSearchParams();
  const city = params.get('city') ?? 'bursa';
  const requestedStatus = params.get('status');
  const status: DraftStatus = requestedStatus === 'published' || requestedStatus === 'rejected' ? requestedStatus : 'pending';
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
  const { data, isLoading, error } = useTextDrafts(city, status);
  const qc = useQueryClient();

  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    // Öncelik grubu içinde kitap sırası: cilt, sonra basılı sayfa.
    return (data ?? [])
      .filter(
        (d) =>
          !needle ||
          tr(d.work.name).toLocaleLowerCase('tr').includes(needle) ||
          (d.work.district ?? '').toLocaleLowerCase('tr').includes(needle),
      )
      .sort((a, b) => (status === 'pending' ? draftGroup(a) - draftGroup(b) : 0) || (a.source.volume ?? 0) - (b.source.volume ?? 0) || a.page - b.page);
  }, [data, q, status]);
  const draft = list.find((d) => d.work.slug === slug) ?? list[0] ?? null;

  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const actionRunning = useRef(false);
  const [err, setErr] = useState('');
  const [shownDraft, setShownDraft] = useState<string | null>(null);
  const [langView, setLangView] = useState<LangView>('tr');

  // Taslak değişince form ondan kurulur (render sırasında; efektte değil).
  if ((draft?.id ?? null) !== shownDraft) {
    setShownDraft(draft?.id ?? null);
    setForm(draft ? toForm(draft) : null);
    setErr('');
  }

  const isDirty = useMemo(() => {
    if (!draft || !form) return false;
    const base = toForm(draft);
    return form.built_year !== base.built_year || form.founder !== base.founder ||
      FIELDS.some(({ key }) => form[key].tr !== base[key].tr || form[key].en !== base[key].en);
  }, [draft, form]);

  const go = (delta: number) => {
    if (list.length === 0) return;
    const i = draft ? list.findIndex((d) => d.id === draft.id) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, i + delta))];
    if (next) set({ work: next.work.slug });
  };

  const act = async (fn: () => Promise<void>, successMessage: string, advance = true) => {
    if (!draft || actionRunning.current) return;
    actionRunning.current = true;
    setBusy(true);
    setErr('');
    const i = list.findIndex((d) => d.id === draft.id);
    const next = list[i + 1] ?? list[i - 1] ?? null;
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['text-drafts', city] });
      void qc.invalidateQueries({ queryKey: ['work', draft.work.slug] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(successMessage);
      if (advance) set({ work: next?.work.slug ?? null });
      else {
        setForm(toForm(draft));
        setShownDraft(null);
      }
    } catch (e) {
      const msg = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      actionRunning.current = false;
    }
  };

  const publish = () => {
    if (!draft || !form || busy || draft.status === 'rejected' || (draft.status === 'published' && !isDirty)) return;
    const year = form.built_year.trim() ? Number(form.built_year) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1000 || year > 2100)) {
      setErr('Yapım yılı 1000–2100 arasında tam sayı olmalı.');
      return;
    }
    const fields = {
      address: localized(form.address),
      history: localized(form.history),
      architecture: localized(form.architecture),
      built_year: year,
      founder: form.founder.trim() || null,
      period: localized(form.period),
      summary: localized(form.summary),
    };
    if (!fields.address && !fields.history && !fields.architecture) {
      const msg = 'Yayınlanacak Türkçe metin yok.';
      setErr(msg);
      toast.error(msg);
      return;
    }
    void act(() => publishDraft(draft, fields), draft.status === 'published' ? 'Yayınlanmış metin ve bilgiler kaydedildi.' : 'Metin taslağı esere yayınlandı.', draft.status !== 'published');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.repeat &&
        !document.querySelector('[role="alertdialog"], [role="dialog"]')) {
        event.preventDefault();
        publish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const cities = (lookups?.cities ?? []).filter((c) => c.slug !== 'istanbul');
  const page = draft ? (draft.page_end && draft.page_end !== draft.page ? `s. ${draft.page}–${draft.page_end}` : `s. ${draft.page}`) : '';
  const bookUrl = draft ? bookPageUrl(draft.source.url, draft.pdf_page) : null;
  const draftIndex = draft ? list.findIndex((d) => d.id === draft.id) : -1;
  const visibleLangs: ('tr' | 'en')[] = langView === 'both' ? ['tr', 'en'] : [langView];

  return (
    <>
      <PageHeader
        hint="Envanter kitaplarından (hackathon veri seti) çıkarılan taslaklar. Kitap sayfasıyla karşılaştırıp düzeltin; yayınlanan metin uygulamada eser sayfasında, kitap atfıyla görünür."
        actions={
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor="texts-city-select">İl</FieldLabel>
            <Select value={city} onValueChange={(v) => set({ city: v, work: null })}>
              <SelectTrigger id="texts-city-select" className="min-w-40 bg-card">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(v) => set({ status: v, work: null })}>
            <TabsList aria-label="Durum">
              {STATUSES.map((s) => (
                <TabsTrigger key={s} value={s} className="gap-1.5 px-3">
                  <span>{DRAFT_STATUS_LABEL[s]}</span>
                  {status === s && data ? (
                    <Badge variant="default" className="num">
                      {list.length}
                    </Badge>
                  ) : null}
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

        {data ? (
          <Badge variant="secondary" className="num">
            {list.length} taslak
          </Badge>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Taslaklar alınamadı</AlertTitle>
          <AlertDescription>{typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error)}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton className="h-[560px] rounded-xl" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        </div>
      ) : null}

      {data ? (
        <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="py-3 lg:sticky lg:top-4">
            <CardHeader className="border-b px-3 pb-2.5">
              <CardTitle className="text-sm">{DRAFT_STATUS_LABEL[status]} taslaklar</CardTitle>
              <CardDescription className="num text-xs">
                {list.length} taslak {draftIndex >= 0 ? `· ${draftIndex + 1} / ${list.length}` : ''}
              </CardDescription>
              <CardAction className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={draftIndex <= 0}
                  onClick={() => go(-1)}
                  aria-label="Önceki taslak"
                  title="Önceki taslak"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={draftIndex < 0 || draftIndex >= list.length - 1}
                  onClick={() => go(1)}
                  aria-label="Sonraki taslak"
                  title="Sonraki taslak"
                >
                  <ChevronRight />
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-2">
              {list.length === 0 ? (
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>Bu süzgeçte taslak yok</EmptyTitle>
                    <EmptyDescription>Başka bir durum sekmesi seçin ya da aramayı temizleyin.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-[calc(100vh-280px)] min-h-[380px]">
                  <ul aria-label="Taslaklar" className="flex flex-col gap-1 pr-2">
                    {list.map((d, index) => {
                      const isSelected = d.id === draft?.id;
                      return (
                        <li key={d.id}>
                          {status === 'pending' && (index === 0 || draftGroup(list[index - 1]) !== draftGroup(d)) ? (
                            <h3 className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground">{GROUP_LABELS[draftGroup(d)]}</h3>
                          ) : null}
                          <button
                            type="button"
                            aria-current={isSelected}
                            onClick={() => set({ work: d.work.slug })}
                            className={cn(
                              'flex min-h-12 w-full flex-col gap-1 rounded-lg border-l-4 px-3 py-2 text-left transition-colors',
                              isSelected
                                ? 'border-l-primary-foreground bg-primary/25 font-bold text-foreground'
                                : 'border-l-transparent hover:bg-muted/70',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={cn('text-sm leading-snug break-words', isSelected ? 'font-bold' : 'font-semibold')}>
                                {tr(d.work.name)}
                              </span>
                              {isSelected ? (
                                <Badge variant="default" className="shrink-0">
                                  Seçili
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
                              <span>
                                {d.work.district ?? '—'} · {d.source.volume ? `C${d.source.volume} ` : ''}s. {d.page}
                              </span>
                              {PILOT_WORKS.has(d.work.slug) ? <Badge variant="secondary">Pilot</Badge> : null}
                              {d.hasPhotos ? <Badge variant="outline">Fotoğraflı</Badge> : null}
                              {d.warnings.length > 0 ? (
                                <Badge variant="warning" className="num">
                                  {d.warnings.length} uyarı
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {draft && form ? (
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <BookPage url={draft.source.url} pdfPage={draft.pdf_page} printedPage={draft.page} pageEnd={draft.page_end} />
            <section className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-32px)] xl:overflow-y-auto xl:pr-2 [&>*]:shrink-0" aria-label="Taslak düzenleme">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-extrabold">{tr(draft.work.name)}</CardTitle>
                    <Badge variant={draft.status === 'published' ? 'success' : draft.status === 'pending' ? 'secondary' : 'outline'}>
                      {DRAFT_STATUS_LABEL[draft.status]}
                    </Badge>
                    {isDirty ? <Badge variant="warning">Kaydedilmemiş değişiklik var</Badge> : null}
                    {draft.edited_at ? <Badge variant="outline" title="Veri hattı bu taslağı yeniden üretimde ezmez">Elle düzenlendi</Badge> : null}
                  </div>
                  <CardDescription>
                    Kaynak atfı: <strong>{draft.source.title}</strong>
                    {draft.source.volume ? ` · Cilt ${draft.source.volume}` : ''} · {page}
                    {draft.work.district ? ` · ${draft.work.district}` : ''}
                  </CardDescription>
                  <CardAction className="flex flex-wrap items-center gap-2">
                    {bookUrl ? (
                      <Button variant="secondary" size="sm" asChild>
                        <a href={bookUrl} target="_blank" rel="noreferrer">
                          <BookOpen data-icon="inline-start" />
                          Kitapta aç ({page})
                          <ExternalLink data-icon="inline-end" />
                        </a>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/eserler/${draft.work.slug}`}>
                        <Pencil data-icon="inline-start" />
                        Eseri düzenle
                      </Link>
                    </Button>
                  </CardAction>
                </CardHeader>

                {draft.warnings.length > 0 ? (
                  <CardContent className="pt-0">
                    <Alert>
                      <TriangleAlert />
                      <AlertTitle>Ayrıştırma uyarıları</AlertTitle>
                      <AlertDescription className="flex flex-wrap gap-1.5 pt-1" aria-label="Uyarılar">
                        {draft.warnings.map((w) => (
                          <Badge key={w} variant="warning">
                            {WARNING_LABEL[w] ?? w}
                          </Badge>
                        ))}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                ) : null}
                <NameFromBook draft={draft} />
              </Card>

              {err ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>İşlem tamamlanamadı</AlertTitle>
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs value={langView} onValueChange={(v) => { if (v === 'tr' || v === 'en' || v === 'both') setLangView(v); }}>
                  <TabsList aria-label="Düzenleme dili">
                    <TabsTrigger value="tr" className="gap-1.5 px-3">
                      <span>Türkçe (TR)</span>
                    </TabsTrigger>
                    <TabsTrigger value="en" className="gap-1.5 px-3">
                      <span>İngilizce (EN)</span>
                    </TabsTrigger>
                    <TabsTrigger value="both" className="gap-1.5 px-3">
                      <span>Yan yana (TR + EN)</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {isDirty && draft.status !== 'rejected' ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setForm(toForm(draft))}>
                    <RotateCcw data-icon="inline-start" />
                    Değişiklikleri geri al
                  </Button>
                ) : null}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Kitaptan bilgiler</CardTitle>
                  <CardDescription>Yalnızca kitapta belirtilen bilgileri girin; yayınlanınca bu sayfa kaynak olarak gösterilir.</CardDescription>
                </CardHeader>
                <CardContent>
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="draft-built-year">Yapım yılı</FieldLabel>
                      <Input id="draft-built-year" type="number" min={1000} max={2100} step={1} className="min-h-12" value={form.built_year} readOnly={draft.status === 'rejected' || busy} onChange={(e) => setForm({ ...form, built_year: e.target.value })} />
                      <FieldDescription>İsteğe bağlı; kitapta kesin yıl verilmemişse boş bırakın.</FieldDescription>
                      <BuiltYearSuggest
                        text={[form.history.tr, form.architecture.tr].filter(Boolean).join('\n\n')}
                        current={form.built_year.trim()}
                        disabled={draft.status === 'rejected' || busy}
                        onPick={(year) => setForm({ ...form, built_year: String(year) })}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="draft-founder">Banisi</FieldLabel>
                      <Input id="draft-founder" className="min-h-12" value={form.founder} readOnly={draft.status === 'rejected' || busy} onChange={(e) => setForm({ ...form, founder: e.target.value })} />
                    </Field>
                  </FieldGroup>
                </CardContent>
              </Card>

              {FIELDS.map(({ key, label, rows }) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-base">{label}</CardTitle>
                  {key === 'address' || key === 'history' || key === 'architecture' ? <CardAction>
                    <PublishedNote value={draft.work[key]} draft={draft[key]} />
                  </CardAction> : null}
                  </CardHeader>
                  <CardContent>
                    <FieldGroup className={cn(langView === 'both' && 'grid gap-4 md:grid-cols-2')}>
                      {visibleLangs.map((l) => {
                        const fieldId = `draft-${key}-${l}`;
                        return (
                          <Field key={l}>
                            <FieldLabel htmlFor={fieldId}>{l === 'tr' ? 'Türkçe (TR)' : 'İngilizce (EN)'}</FieldLabel>
                            <Textarea
                              id={fieldId}
                              rows={rows}
                              lang={l}
                              value={form[key][l]}
                              readOnly={draft.status === 'rejected' || busy}
                              onChange={(e) => setForm({ ...form, [key]: { ...form[key], [l]: e.target.value } })}
                            />
                            <FieldDescription className="num">{form[key][l].length} karakter</FieldDescription>
                            {key === 'summary' ? <FieldDescription>Kitap metninden, kaynakta olmayan bilgi eklemeden 2–3 cümlelik sade özet</FieldDescription> : null}
                          </Field>
                        );
                      })}
                    </FieldGroup>
                    {key === 'history' && draft.status !== 'rejected' ? (
                      <div className={cn('mt-4 grid gap-4', langView === 'both' && 'md:grid-cols-2')}>
                        {visibleLangs.map((l) => (
                          <ArchitectureSuggest
                            key={`${draft.id}-${l}`}
                            history={form.history[l]}
                            architecture={form.architecture[l]}
                            lang={l}
                            disabled={busy}
                            onApply={(next) => setForm({ ...form, history: { ...form.history, [l]: next.history }, architecture: { ...form.architecture, [l]: next.architecture } })}
                          />
                        ))}
                      </div>
                    ) : null}
                    {key === 'summary' && draft.status !== 'rejected' ? (
                      <div className="mt-4">
                        <SummarySuggest
                          suggestion={draft.summary_suggestion}
                          by={draft.summary_suggestion_by}
                          at={draft.summary_suggested_at}
                          source={summarySourceOf(form)}
                          disabled={busy}
                          onGenerate={async () => {
                            await requestSummary(draft.id, summarySourceOf(form));
                            await qc.invalidateQueries({ queryKey: ['text-drafts', city] });
                          }}
                          onApply={(next) => setForm({ ...form, summary: next })}
                        />
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}

              {draft.status === 'pending' ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Yayın onayı</CardTitle>
                    <CardDescription>
                      Metin yalnızca yönetici kararıyla esere yayınlanır; hiçbir taslak kendiliğinden yayına girmez.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Yayınlayarak metni kitap sayfasıyla karşılaştırdığınızı onaylarsınız. Yanlış dil, eksik paragraf veya başka eserin metni olmadığını kontrol edin.</p>
                  </CardContent>
                  <CardFooter className="flex flex-wrap items-center gap-2">
                    <Button className="min-h-12" disabled={busy} onClick={publish} aria-keyshortcuts="Control+Enter Meta+Enter">
                      {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                      Kitapla karşılaştırdım · Yayınla <Kbd>Ctrl+Enter</Kbd>
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={busy}>
                          <X data-icon="inline-start" />
                          Reddet
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Metin taslağı reddedilsin mi?</AlertDialogTitle>
                          <AlertDialogDescription>
                            <strong>{tr(draft.work.name)}</strong> için çıkarılan bu taslak reddedilecek ve bekleyenler kuyruğundan
                            çıkarılacak. Eserdeki mevcut metin değişmez.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => void act(() => setDraftStatus(draft.id, 'rejected'), 'Metin taslağı reddedildi.')}
                          >
                            Taslağı reddet
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    <Button variant="ghost" disabled={busy || !isDirty} onClick={() => setForm(toForm(draft))}>
                      <RotateCcw data-icon="inline-start" />
                      Değişiklikleri geri al
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={draft.status === 'published' ? 'success' : 'outline'}>
                        {DRAFT_STATUS_LABEL[draft.status]}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {draft.status === 'published' ? 'Kaydettiğiniz düzeltmeler aynı kitap atfıyla esere de uygulanır.' : 'Beklemeye alarak taslağı yeniden düzenleyebilirsiniz; eserdeki metin değişmez.'}
                      </span>
                    </div>
                    {draft.status === 'published' ? <Button className="min-h-12" disabled={busy || !isDirty} onClick={publish} aria-keyshortcuts="Control+Enter Meta+Enter">
                      {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />} Kaydet <Kbd>Ctrl+Enter</Kbd>
                    </Button> : null}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void act(() => setDraftStatus(draft.id, 'pending'), 'Taslak yeniden beklemeye alındı.')}
                      title="Taslak yeniden düzenlenebilir olur; eserdeki metin değişmez"
                    >
                      {busy ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
                      Beklemeye al
                    </Button>
                  </CardContent>
                </Card>
              )}
            </section>
            </div>
          ) : (
            <Card>
              <CardContent>
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FileText />
                    </EmptyMedia>
                    <EmptyTitle>İncelenecek taslak seçin</EmptyTitle>
                    <EmptyDescription>Soldaki kuyruktan bir taslak seçerek metinleri kitap sayfasıyla karşılaştırabilirsiniz.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </>
  );
}

/** Eserde yayınlanmış metin taslaktan farklıysa uyarır (yayınla eskisinin üzerine yazar). */
function PublishedNote({ value, draft }: { value: LocalizedText | null; draft: LocalizedText | null }) {
  if (!value?.tr) return <Badge variant="outline">Eserde henüz yok</Badge>;
  if (value.tr === draft?.tr && (value.en ?? '') === (draft?.en ?? '')) {
    return <Badge variant="success">✓ Eserdekiyle aynı</Badge>;
  }
  return <Badge variant="warning">! Eserde farklı bir metin var; yayınlamak üzerine yazar</Badge>;
}
