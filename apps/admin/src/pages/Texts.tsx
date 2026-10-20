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
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';

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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { localized, tr, useLookups } from '@/lib/data';
import {
  bookPageUrl,
  DRAFT_STATUS_LABEL,
  publishDraft,
  setDraftStatus,
  useTextDrafts,
  WARNING_LABEL,
  type DraftStatus,
  type TextDraft,
} from '@/lib/review';

type DraftFieldKey = 'address' | 'history' | 'architecture';
const FIELDS: { key: DraftFieldKey; label: string; rows: number }[] = [
  { key: 'address', label: 'Adres', rows: 4 },
  { key: 'history', label: 'Tarihçe', rows: 14 },
  { key: 'architecture', label: 'Mimari', rows: 8 },
];
type Form = Record<DraftFieldKey, { tr: string; en: string }>;
type LangView = 'tr' | 'en' | 'both';

function toForm(d: TextDraft): Form {
  return {
    address: { tr: d.address?.tr ?? '', en: d.address?.en ?? '' },
    history: { tr: d.history?.tr ?? '', en: d.history?.en ?? '' },
    architecture: { tr: d.architecture?.tr ?? '', en: d.architecture?.en ?? '' },
  };
}

const STATUSES: DraftStatus[] = ['pending', 'published', 'rejected'];

/**
 * Kitaptan metin taslakları: veri hattı her eserin sayfalarından adres, tarihçe ve mimari metnini (TR/EN) ayırır.
 * Admin kitap sayfasıyla karşılaştırıp düzeltir ve esere yayınlar. Yayınlanan metin uygulamada eser sayfasında görünür.
 */
export function Texts() {
  const [params, setParams] = useSearchParams();
  const city = params.get('city') ?? 'bursa';
  const status = (params.get('status') as DraftStatus | null) ?? 'pending';
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
    // Kitap sırası: cilt, sonra sayfa.
    return (data ?? [])
      .filter(
        (d) =>
          !needle ||
          tr(d.work.name).toLocaleLowerCase('tr').includes(needle) ||
          (d.work.district ?? '').toLocaleLowerCase('tr').includes(needle),
      )
      .sort((a, b) => (a.source.volume ?? 0) - (b.source.volume ?? 0) || a.page - b.page);
  }, [data, q]);
  const draft = list.find((d) => d.work.slug === slug) ?? list[0] ?? null;

  const [form, setForm] = useState<Form | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shownDraft, setShownDraft] = useState<string | null>(null);
  const [langView, setLangView] = useState<LangView>('tr');

  // Taslak değişince form ondan kurulur (render sırasında; efektte değil).
  if ((draft?.id ?? null) !== shownDraft) {
    setShownDraft(draft?.id ?? null);
    setForm(draft ? toForm(draft) : null);
    setChecked(false);
    setErr('');
  }

  const isDirty = useMemo(() => {
    if (!draft || !form) return false;
    const base = toForm(draft);
    return FIELDS.some(({ key }) => form[key].tr !== base[key].tr || form[key].en !== base[key].en);
  }, [draft, form]);

  const go = (delta: number) => {
    if (list.length === 0) return;
    const i = draft ? list.findIndex((d) => d.id === draft.id) : -1;
    const next = list[Math.min(list.length - 1, Math.max(0, i + delta))];
    if (next) set({ work: next.work.slug });
  };

  const act = async (fn: () => Promise<void>, successMessage: string) => {
    if (!draft) return;
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
      set({ work: next?.work.slug ?? null });
    } catch (e) {
      const msg = typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e);
      setErr(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const publish = () => {
    if (!draft || !form) return;
    const fields = {
      address: localized(form.address),
      history: localized(form.history),
      architecture: localized(form.architecture),
    };
    if (!fields.address && !fields.history && !fields.architecture) {
      const msg = 'Yayınlanacak Türkçe metin yok.';
      setErr(msg);
      toast.error(msg);
      return;
    }
    void act(() => publishDraft(draft, fields), 'Metin taslağı esere yayınlandı.');
  };

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
        <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
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
                    {list.map((d) => {
                      const isSelected = d.id === draft?.id;
                      return (
                        <li key={d.id}>
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
            <section className="flex flex-col gap-4" aria-label="Taslak düzenleme">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-extrabold">{tr(draft.work.name)}</CardTitle>
                    <Badge variant={draft.status === 'published' ? 'success' : draft.status === 'pending' ? 'secondary' : 'outline'}>
                      {DRAFT_STATUS_LABEL[draft.status]}
                    </Badge>
                    {isDirty ? <Badge variant="warning">Kaydedilmemiş değişiklik var</Badge> : null}
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
              </Card>

              {err ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>İşlem tamamlanamadı</AlertTitle>
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs value={langView} onValueChange={(v) => setLangView(v as LangView)}>
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

                {isDirty && draft.status === 'pending' ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setForm(toForm(draft))}>
                    <RotateCcw data-icon="inline-start" />
                    Değişiklikleri geri al
                  </Button>
                ) : null}
              </div>

              {FIELDS.map(({ key, label, rows }) => (
                <Card key={key}>
                  <CardHeader>
                    <CardTitle className="text-base">{label}</CardTitle>
                    <CardAction>
                      <PublishedNote value={draft.work[key]} draft={draft[key]} />
                    </CardAction>
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
                              readOnly={draft.status !== 'pending'}
                              onChange={(e) => setForm({ ...form, [key]: { ...form[key], [l]: e.target.value } })}
                            />
                            <FieldDescription className="num">{form[key][l].length} karakter</FieldDescription>
                          </Field>
                        );
                      })}
                    </FieldGroup>
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
                    <Field orientation="horizontal">
                      <Checkbox
                        id="confirm-book-comparison"
                        checked={checked}
                        onCheckedChange={(v) => setChecked(v === true)}
                      />
                      <FieldLabel htmlFor="confirm-book-comparison" className="font-normal">
                        Metni kitaptaki sayfayla karşılaştırdım; ayrıştırma hatası (yanlış dil, eksik paragraf, başka eserin metni) yok.
                      </FieldLabel>
                    </Field>
                  </CardContent>
                  <CardFooter className="flex flex-wrap items-center gap-2">
                    <Button disabled={busy || !checked} onClick={publish}>
                      {busy ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
                      Esere yayınla
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
                        Taslak yeniden düzenlenebilir olur; eserdeki yayınlanmış metin değişmez.
                      </span>
                    </div>
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
