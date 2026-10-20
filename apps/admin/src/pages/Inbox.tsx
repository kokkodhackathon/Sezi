import type { LocalizedText } from '@sezi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import {
  BookOpen,
  Check,
  ChevronsUpDown,
  CircleAlert,
  ExternalLink,
  FolderOpen,
  Images,
  Info,
  Link2,
  Link2Off,
  ZoomIn,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mediaUrl, searchWorks, tr, useInbox, type InboxPhoto } from '@/lib/data';
import { supabase } from '@/lib/supabase';

type InboxTab = 'unlinked' | 'draft';

interface DraftMediaRow {
  id: string;
  work_id: string | null;
  storage_path: string;
  thumb_path: string | null;
  folder: string | null;
  source_file: string | null;
  source_volume: number | null;
  source_page: number | null;
  kind: 'photo' | 'aerial' | 'inscription';
  alt_text: LocalizedText | null;
  work: {
    id: string;
    slug: string;
    name: LocalizedText;
    district: string | null;
  } | null;
}

interface PreviewState {
  url: string;
  title: string;
  subtitle: string;
}

const KIND_LABEL: Record<InboxPhoto['kind'], string> = {
  photo: 'Fotoğraf',
  aerial: 'Havadan görünüm',
  inscription: 'Kitabe',
};

/** Arşiv klasör adından ilçe ipucu: "4-İnegöl Klasörü" → İnegöl. */
function districtHint(folder: string | null): string {
  if (!folder) return '';
  const m = folder.match(/^\d+-(.+?) Klasörü$/);
  return m ? m[1]! : '';
}

/**
 * Fotoğraf kutusu: kitapta eşleşmeyen arşiv fotoğrafları ve onay bekleyen taslak fotoğraflar.
 * Admin fotoğrafa bakıp esere bağlar ya da taslak eşleşmeyi onaylar; onaylanan fotoğraf uygulamada görünür.
 */
export function Inbox() {
  const [tab, setTab] = useState<InboxTab>('unlinked');
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const { data: unlinkedData, isLoading: unlinkedLoading, error: unlinkedError, refetch: refetchUnlinked } = useInbox();
  const {
    data: draftRows,
    isLoading: draftsLoading,
    error: draftsError,
    refetch: refetchDrafts,
  } = useQuery({
    queryKey: ['inbox', 'drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('media')
        .select('id, work_id, storage_path, thumb_path, folder, source_file, source_volume, source_page, kind, alt_text, work:works(id, slug, name, district)')
        .eq('status', 'draft')
        .order('source_volume')
        .order('source_page')
        .order('source_file');
      if (error) throw error;
      return (data ?? []) as unknown as DraftMediaRow[];
    },
  });

  const metaById = new Map<string, DraftMediaRow>();
  for (const row of draftRows ?? []) {
    metaById.set(row.id, row);
  }

  const unlinkedPhotos = unlinkedData ?? [];
  const draftLinkedPhotos = (draftRows ?? []).filter((r) => r.work_id !== null);

  const groups = new Map<string, InboxPhoto[]>();
  for (const p of unlinkedPhotos) {
    const key = p.folder ?? 'Klasörsüz';
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const isLoading = unlinkedLoading || draftsLoading;
  const error = unlinkedError ?? draftsError;

  return (
    <>
      <PageHeader />

      <Alert>
        <Info />
        <AlertTitle>Vakıf Katılım envanter fotoğraf arşivi</AlertTitle>
        <AlertDescription>
          Kitaptaki kareyle otomatik eşleşmeyen fotoğraflar burada esere elle bağlanır. Taslak olarak bağlanan fotoğraflar onaylanınca mobil uygulamada görünür.
        </AlertDescription>
      </Alert>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Fotoğraf kutusu alınamadı</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                void refetchUnlinked();
                void refetchDrafts();
              }}
            >
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as InboxTab)}>
        <TabsList aria-label="Fotoğraf durumu">
          <TabsTrigger value="unlinked">
            <span>Esere bağlanmamış</span>
            {!unlinkedLoading ? (
              <Badge variant="secondary" className="num">
                {unlinkedPhotos.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="draft">
            <span>Onay bekleyen</span>
            {!draftsLoading ? (
              <Badge variant="secondary" className="num">
                {draftLinkedPhotos.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unlinked" className="flex flex-col gap-6 pt-2">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : unlinkedPhotos.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Images />
                </EmptyMedia>
                <EmptyTitle>Esere bağlanmamış fotoğraf yok</EmptyTitle>
                <EmptyDescription>Arşivdeki tüm fotoğraflar bir eserle ilişkilendirilmiş durumda.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            [...groups].map(([folder, photos]) => (
              <section key={folder} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
                  <h2 className="text-lg font-bold">{folder}</h2>
                  <Badge variant="secondary" className="num">
                    {photos.length}
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {photos.map((p) => (
                    <UnlinkedPhotoCard
                      key={p.id}
                      photo={p}
                      meta={metaById.get(p.id)}
                      onPreview={setPreview}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </TabsContent>

        <TabsContent value="draft" className="flex flex-col gap-6 pt-2">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
              <Skeleton className="h-80 w-full rounded-xl" />
            </div>
          ) : draftLinkedPhotos.length === 0 ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Images />
                </EmptyMedia>
                <EmptyTitle>Onay bekleyen fotoğraf yok</EmptyTitle>
                <EmptyDescription>Esere bağlı taslak fotoğrafların tümü incelenmiş durumda.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {draftLinkedPhotos.map((p) => (
                <DraftLinkedPhotoCard key={p.id} photo={p} onPreview={setPreview} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.title ?? 'Fotoğraf önizleme'}</DialogTitle>
            <DialogDescription>{preview?.subtitle}</DialogDescription>
          </DialogHeader>
          {preview ? (
            <img
              src={preview.url}
              alt={preview.title}
              className="max-h-[72vh] w-full rounded-lg bg-muted object-contain"
            />
          ) : null}
          <DialogFooter>
            {preview ? (
              <Button variant="outline" size="sm" asChild>
                <a href={preview.url} target="_blank" rel="noreferrer">
                  Yeni sekmede aç
                  <ExternalLink data-icon="inline-end" />
                </a>
              </Button>
            ) : null}
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

interface SelectedWork {
  id: string;
  slug: string;
  name: LocalizedText;
  district: string | null;
  type_name: LocalizedText;
}

function WorkCombobox({
  initialQuery,
  selected,
  onSelect,
  placeholder = 'Eser seçin…',
}: {
  initialQuery: string;
  selected: SelectedWork | null;
  onSelect: (w: SelectedWork) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(initialQuery);
  const results = useQuery({
    queryKey: ['work-search', q],
    queryFn: () => searchWorks(q, 'bursa'),
    enabled: open,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? tr(selected.name) : placeholder}
          </span>
          <ChevronsUpDown data-icon="inline-end" className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder="Eser adı ya da ilçe ara…"
          />
          <CommandList>
            {results.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                <Spinner />
                <span>Aranıyor…</span>
              </div>
            ) : results.data?.length === 0 ? (
              <CommandEmpty>Eşleşen eser bulunamadı.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.data?.map((w) => {
                  const isSelected = selected?.id === w.id;
                  const meta = [tr(w.type_name), w.district].filter(Boolean).join(' · ');
                  return (
                    <CommandItem
                      key={w.id}
                      value={w.id}
                      onSelect={() => {
                        onSelect(w);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn('size-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium">{tr(w.name)}</span>
                        {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UnlinkedPhotoCard({
  photo,
  meta,
  onPreview,
}: {
  photo: InboxPhoto;
  meta: DraftMediaRow | undefined;
  onPreview: (p: PreviewState) => void;
}) {
  const qc = useQueryClient();
  const [selectedWork, setSelectedWork] = useState<SelectedWork | null>(null);
  const fileName = photo.source_file?.split('/').pop() ?? photo.storage_path.split('/').pop() ?? 'Fotoğraf';
  const bookRef = meta?.source_page
    ? `Cilt ${meta.source_volume ?? '?'} · s. ${meta.source_page}`
    : 'Kitap sayfası yok';

  const assign = useMutation({
    mutationFn: async ({ work, publish }: { work: SelectedWork; publish: boolean }) => {
      // Galerinin sonuna: mevcut fotoğraf sayısı kadar sıra.
      const { count } = await supabase.from('media').select('id', { count: 'exact', head: true }).eq('work_id', work.id);
      const suffix =
        photo.kind === 'aerial'
          ? { tr: ', havadan görünüm', en: ', aerial view' }
          : photo.kind === 'inscription'
            ? { tr: ', kitabe', en: ', inscription' }
            : { tr: '', en: '' };
      const { error } = await supabase
        .from('media')
        .update({
          work_id: work.id,
          status: publish ? 'verified' : 'draft',
          sort_order: count ?? 0,
          alt_text: { tr: `${work.name.tr}${suffix.tr}`, en: `${work.name.en ?? work.name.tr}${suffix.en}` },
        })
        .eq('id', photo.id);
      if (error) throw error;
      return { workName: tr(work.name), publish };
    },
    onSuccess: ({ workName, publish }) => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['works'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(
        publish
          ? `Fotoğraf “${workName}” eserine bağlandı ve yayımlandı.`
          : `Fotoğraf “${workName}” eserine taslak olarak bağlandı.`,
      );
    },
    onError: (e) => {
      toast.error(`Fotoğraf bağlanamadı: ${e.message}`);
    },
  });
  const busy = assign.isPending;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="gap-2">
        <button
          type="button"
          onClick={() =>
            onPreview({
              url: mediaUrl(photo.storage_path),
              title: fileName,
              subtitle: [photo.folder ?? 'Klasörsüz', KIND_LABEL[photo.kind], bookRef].join(' · '),
            })
          }
          className="group relative overflow-hidden rounded-lg border bg-muted text-left"
          aria-label={`${fileName} fotoğrafını büyüt`}
        >
          <img
            src={mediaUrl(photo.thumb_path ?? photo.storage_path)}
            alt={fileName}
            loading="lazy"
            className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground">
            <ZoomIn className="size-3.5" aria-hidden />
            Büyüt
          </span>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
          <Badge variant="outline">{KIND_LABEL[photo.kind]}</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="size-3" aria-hidden />
            {bookRef}
          </span>
        </div>

        <CardTitle className="truncate text-sm font-semibold" title={fileName}>
          {fileName}
        </CardTitle>
        <CardDescription className="truncate text-xs" title={photo.folder ?? 'Klasörsüz'}>
          {photo.folder ?? 'Klasörsüz'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Bağlanacak eser</FieldLabel>
            <WorkCombobox
              initialQuery={districtHint(photo.folder)}
              selected={selectedWork}
              onSelect={setSelectedWork}
            />
          </Field>
        </FieldGroup>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="flex-1"
          disabled={!selectedWork || busy}
          onClick={() => selectedWork && assign.mutate({ work: selectedWork, publish: true })}
        >
          {assign.isPending && assign.variables?.publish ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Onayla ve yayımla
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedWork || busy}
          onClick={() => selectedWork && assign.mutate({ work: selectedWork, publish: false })}
        >
          {assign.isPending && !assign.variables?.publish ? <Spinner data-icon="inline-start" /> : <Link2 data-icon="inline-start" />}
          Taslak bağla
        </Button>
      </CardFooter>
    </Card>
  );
}

function DraftLinkedPhotoCard({
  photo,
  onPreview,
}: {
  photo: DraftMediaRow;
  onPreview: (p: PreviewState) => void;
}) {
  const qc = useQueryClient();
  const [reassignedWork, setReassignedWork] = useState<SelectedWork | null>(null);

  const workName = photo.work ? tr(photo.work.name) : 'Bağlı eser';
  const fileName = photo.source_file?.split('/').pop() ?? photo.storage_path.split('/').pop() ?? 'Fotoğraf';
  const bookRef = photo.source_page
    ? `Cilt ${photo.source_volume ?? '?'} · s. ${photo.source_page}`
    : 'Kitap sayfası belirtilmemiş';

  const approve = useMutation({
    mutationFn: async () => {
      if (reassignedWork && reassignedWork.id !== photo.work_id) {
        const { count } = await supabase.from('media').select('id', { count: 'exact', head: true }).eq('work_id', reassignedWork.id);
        const suffix =
          photo.kind === 'aerial'
            ? { tr: ', havadan görünüm', en: ', aerial view' }
            : photo.kind === 'inscription'
              ? { tr: ', kitabe', en: ', inscription' }
              : { tr: '', en: '' };
        const { error } = await supabase
          .from('media')
          .update({
            work_id: reassignedWork.id,
            status: 'verified',
            sort_order: count ?? 0,
            alt_text: {
              tr: `${reassignedWork.name.tr}${suffix.tr}`,
              en: `${reassignedWork.name.en ?? reassignedWork.name.tr}${suffix.en}`,
            },
          })
          .eq('id', photo.id);
        if (error) throw error;
        return tr(reassignedWork.name);
      }

      const { error } = await supabase.from('media').update({ status: 'verified' }).eq('id', photo.id);
      if (error) throw error;
      return workName;
    },
    onSuccess: (targetName) => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['works'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`“${targetName}” fotoğrafı onaylandı ve yayımlandı.`);
    },
    onError: (e) => {
      toast.error(`Onaylanamadı: ${e.message}`);
    },
  });

  const rejectLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('media')
        .update({ work_id: null, status: 'draft' })
        .eq('id', photo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['works'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Eser bağı kaldırıldı; fotoğraf bağlanmamışlar sekmesine taşındı.');
    },
    onError: (e) => {
      toast.error(`İşlem başarısız: ${e.message}`);
    },
  });

  const busy = approve.isPending || rejectLink.isPending;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="gap-2">
        <button
          type="button"
          onClick={() =>
            onPreview({
              url: mediaUrl(photo.storage_path),
              title: workName,
              subtitle: [bookRef, fileName, KIND_LABEL[photo.kind]].join(' · '),
            })
          }
          className="group relative overflow-hidden rounded-lg border bg-muted text-left"
          aria-label={`${workName} fotoğrafını büyüt`}
        >
          <img
            src={mediaUrl(photo.thumb_path ?? photo.storage_path)}
            alt={tr(photo.alt_text) || workName}
            loading="lazy"
            className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-[1.02]"
          />
          <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-md bg-background/90 px-2 py-1 text-xs font-medium text-foreground">
            <ZoomIn className="size-3.5" aria-hidden />
            Büyüt
          </span>
        </button>

        <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="warning">Taslak</Badge>
            <Badge variant="outline">{KIND_LABEL[photo.kind]}</Badge>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="size-3" aria-hidden />
            {bookRef}
          </span>
        </div>

        <CardTitle className="text-base">
          {photo.work ? (
            <Link
              to={`/eserler/${photo.work.slug}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <span>{workName}</span>
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
            </Link>
          ) : (
            workName
          )}
        </CardTitle>
        <CardDescription className="truncate text-xs" title={fileName}>
          {[photo.work?.district, photo.folder, fileName].filter(Boolean).join(' · ')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Başka esere taşı (isteğe bağlı)</FieldLabel>
            <WorkCombobox
              initialQuery={photo.work?.district ?? districtHint(photo.folder)}
              selected={reassignedWork}
              onSelect={setReassignedWork}
              placeholder={workName}
            />
          </Field>
        </FieldGroup>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button size="sm" className="flex-1" disabled={busy} onClick={() => approve.mutate()}>
          {approve.isPending ? <Spinner data-icon="inline-start" /> : <Check data-icon="inline-start" />}
          Onayla
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={busy}>
              <Link2Off data-icon="inline-start" />
              Reddet
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eser eşleşmesi reddedilsin mi?</AlertDialogTitle>
              <AlertDialogDescription>
                Fotoğrafın “{workName}” eseriyle olan bağı kaldırılacak ve fotoğraf yeniden “Esere bağlanmamış” sekmesine dönecek.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => rejectLink.mutate()}>
                Bağı kaldır
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
