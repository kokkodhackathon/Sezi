import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleAlert, MapPin, Plus, Signpost, Trash2, Volume2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AudioField } from '@/components/AudioField';
import { PageHeader } from '@/components/page-header';
import { hasRadius, PointsMap, primaryRole, ROLE_COLOR } from '@/components/PointsMap';
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
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { LANGS, MAX_AUDIO_BYTES, removeAudio, uploadAudio, type Lang, type Uploaded } from '@/lib/audio';
import {
  AMBIENT_LABEL,
  CITY_CENTER,
  localized,
  ROLE_HINT,
  ROLE_LABEL,
  searchWorks,
  STATUS_LABEL,
  useLookups,
  usePoints,
  type Ambient,
  type PointRole,
  type PointRow,
  type Status,
} from '@/lib/data';
import { supabase } from '@/lib/supabase';
type Pt = [number, number];
type WorkHit = Awaited<ReturnType<typeof searchWorks>>[number];

const ROLES: PointRole[] = ['start', 'landmark', 'story', 'arrival'];
const DEFAULT_RADIUS = 25;

interface Form {
  id: string | null;
  roles: PointRole[];
  title: { tr: string; en: string };
  body: { tr: string; en: string };
  radius: number;
  status: Status;
  sourceNote: string;
  point: Pt | null;
  work: { id: string; name: string } | null;
  salience: number;
  ambient: Ambient | '';
  fieldChecked: boolean;
  sortOrder: number;
  /** Yeni seçilen ses dosyaları. */
  files: Partial<Record<Lang, File>>;
  /** Mevcut kayıtları kaldır. */
  removed: Record<Lang, boolean>;
  /** Form her yeniden kurulduğunda değişir: dosya alanları sıfırlanır. */
  rev: number;
}

const emptyForm = (): Form => ({
  id: null,
  roles: ['story'],
  title: { tr: '', en: '' },
  body: { tr: '', en: '' },
  radius: DEFAULT_RADIUS,
  status: 'draft',
  sourceNote: '',
  point: null,
  work: null,
  salience: 2,
  ambient: '',
  fieldChecked: false,
  sortOrder: 0,
  files: {},
  removed: { tr: false, en: false },
  rev: Date.now(),
});

const toForm = (r: PointRow, workName?: string): Form => ({
  id: r.id,
  roles: r.roles,
  title: { tr: r.title.tr ?? '', en: r.title.en ?? '' },
  body: { tr: r.body?.tr ?? '', en: r.body?.en ?? '' },
  radius: r.radius_m,
  status: r.status,
  sourceNote: r.source_note ?? '',
  point: [r.lng, r.lat],
  work: r.work_id ? { id: r.work_id, name: workName ?? r.work_slug ?? '' } : null,
  salience: r.salience ?? 2,
  ambient: r.ambient ?? '',
  fieldChecked: r.field_checked,
  sortOrder: r.sort_order,
  files: {},
  removed: { tr: false, en: false },
  rev: Date.now(),
});

/** Bu sayfadaki işlemlerin ortak hata iletisi. */
const message = (e: unknown) => (typeof e === 'object' && e && 'message' in e ? String(e.message) : String(e));

/**
 * Nokta editörü: rotaların kullandığı her yer buradan girilir (kodda sabit nokta yok).
 * Başlangıç, yer işareti, anlatım ve eser varışı rolleri; bir yer birden çok rol taşıyabilir.
 */
export function Points() {
  const { data: lookups } = useLookups();
  const [city, setCity] = useState('bursa');
  const { data: points = [], isLoading, error } = usePoints(city);
  const [filter, setFilter] = useState<PointRole | 'all'>('all');
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState('');
  const [workQuery, setWorkQuery] = useState('');
  const [workHits, setWorkHits] = useState<WorkHit[]>([]);
  const qc = useQueryClient();
  // Eser arama: yazmayı bırakınca sorgula.
  useEffect(() => {
    if (form.work) return;
    let alive = true;
    const id = setTimeout(() => {
      searchWorks(workQuery, city)
        .then((hits) => alive && setWorkHits(hits))
        .catch(() => alive && setWorkHits([]));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [workQuery, city, form.work]);

  const current = points.find((p) => p.id === form.id) ?? null;
  const cityId = lookups?.cities.find((c) => c.slug === city)?.id;
  const center = useMemo<Pt>(() => form.point ?? CITY_CENTER[city] ?? CITY_CENTER.bursa, [form.id, city]); // eslint-disable-line react-hooks/exhaustive-deps
  const visible = filter === 'all' ? points : points.filter((p) => p.roles.includes(filter));
  const counts = useMemo(() => Object.fromEntries(ROLES.map((r) => [r, points.filter((p) => p.roles.includes(r)).length])) as Record<PointRole, number>, [points]);

  const select = (r: PointRow) => {
    setForm(toForm(r));
    setFormError('');
    setWorkQuery('');
  };
  const reset = () => {
    setForm(emptyForm());
    setFormError('');
    setWorkQuery('');
  };
  const toggleRole = (role: PointRole) =>
    setForm((f) => ({ ...f, roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role], ...(role === 'arrival' && f.roles.includes(role) ? { work: null } : {}) }));

  /** Eser seçilince konum boşsa eserin konumu kullanılır. */
  const chooseWork = async (w: WorkHit) => {
    setForm((f) => ({ ...f, work: { id: w.id, name: w.name.tr ?? w.slug }, title: f.title.tr ? f.title : { tr: w.name.tr ?? '', en: w.name.en ?? '' } }));
    setWorkHits([]);
    if (form.point) return;
    const { data } = await supabase.from('works_view').select('lng, lat').eq('id', w.id).single();
    const lng = data?.lng;
    const lat = data?.lat;
    if (typeof lng === 'number' && typeof lat === 'number') setForm((f) => (f.point ? f : { ...f, point: [lng, lat] }));
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const text = hasRadius(f.roles);
      if (f.roles.length === 0) throw new Error('En az bir rol seçin.');
      if (!f.title.tr.trim()) throw new Error('Türkçe ad boş olamaz.');
      if (!f.point) throw new Error('Haritaya tıklayarak konum seçin.');
      if (f.roles.includes('arrival') && !f.work) throw new Error('Varış noktası için eser seçin.');
      if (text && (f.radius < 5 || f.radius > 200 || !Number.isFinite(f.radius))) throw new Error('Yarıçap 5 ile 200 m arasında olmalı.');
      if (f.status === 'verified' && text && !f.body.tr.trim()) throw new Error('Yayındaki anlatım/varış noktası için Türkçe metin zorunlu.');
      if (f.status === 'verified' && !f.sourceNote.trim()) throw new Error('Yayındaki nokta için kaynak notu zorunlu.');
      if (!cityId) throw new Error('İl bulunamadı.');
      const title = localized(f.title)!;
      const id = f.id ?? crypto.randomUUID();
      const old = f.id ? points.find((p) => p.id === f.id) : undefined;
      // Anlatım/varış rolü kalktıysa metin ve sesler de kalkar (gizli, bayat içerik kalmasın).
      const removed = text ? f.removed : { tr: true, en: true };
      const files = text ? f.files : {};

      const uploaded: Uploaded[] = [];
      const rollback = () =>
        removeAudio(
          uploaded.map((u) => u.assetId).filter((x): x is string => !!x),
          uploaded.map((u) => u.path),
        );

      const audioIds: Record<Lang, string | null> = { tr: old?.audio_tr_id ?? null, en: old?.audio_en_id ?? null };
      try {
        for (const lang of LANGS) {
          const file = files[lang];
          if (file) {
            audioIds[lang] = await uploadAudio(`points/${id}`, lang, file, `${title.tr} · ${lang.toUpperCase()}`, uploaded);
          } else if (removed[lang]) {
            audioIds[lang] = null;
          }
        }
        const landmark = f.roles.includes('landmark');
        const { error: e } = await supabase.from('nav_points').upsert({
          id,
          city_id: cityId,
          roles: f.roles,
          title,
          body: text ? localized(f.body) : null,
          radius_m: Math.round(text ? f.radius : DEFAULT_RADIUS),
          source_note: f.sourceNote.trim() || null,
          status: f.status,
          // PostGIS, metin olarak verilen EWKT'yi geography'ye çevirir.
          location: `SRID=4326;POINT(${f.point[0]} ${f.point[1]})`,
          work_id: f.work?.id ?? null,
          salience: landmark ? f.salience : null,
          ambient: landmark && f.ambient ? f.ambient : null,
          field_checked: f.fieldChecked,
          sort_order: f.roles.includes('start') ? Math.round(f.sortOrder) : 0,
          audio_tr_id: audioIds.tr,
          audio_en_id: audioIds.en,
        });
        if (e) throw e;
      } catch (err) {
        await rollback();
        throw err;
      }

      // Kayıt geçerli; değiştirilen ya da kaldırılan eski sesleri temizle.
      const stale = LANGS.flatMap((lang) => {
        const oldId = lang === 'tr' ? old?.audio_tr_id : old?.audio_en_id;
        const oldPath = lang === 'tr' ? old?.audio_tr : old?.audio_en;
        return oldId && audioIds[lang] !== oldId ? [{ id: oldId, path: oldPath }] : [];
      });
      const cleanupFailed = await removeAudio(
        stale.map((s) => s.id),
        stale.map((s) => s.path).filter((p): p is string => !!p),
      );
      return { id, cleanupFailed, workName: f.work?.name };
    },
    onSuccess: ({ id, cleanupFailed, workName }) => {
      setFormError('');
      if (cleanupFailed) toast.warning('Kaydedildi · Eski ses dosyası silinemedi');
      else toast.success('Kaydedildi');
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['nav_points', city] }).then(() => {
        const rows = qc.getQueryData<PointRow[]>(['nav_points', city]);
        const saved = rows?.find((r) => r.id === id);
        if (saved) setForm(toForm(saved, workName));
      });
    },
    onError: (e) => setFormError(message(e)),
  });

  const remove = useMutation({
    mutationFn: async (r: PointRow) => {
      const { error: e } = await supabase.from('nav_points').delete().eq('id', r.id);
      if (e) throw e;
      return removeAudio(
        [r.audio_tr_id, r.audio_en_id].filter((x): x is string => !!x),
        [r.audio_tr, r.audio_en].filter((x): x is string => !!x),
      );
    },
    onSuccess: (cleanupFailed) => {
      reset();
      if (cleanupFailed) toast.warning('Silindi · Ses dosyası silinemedi');
      else toast.success('Silindi');
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['nav_points', city] });
    },
    onError: (e) => setFormError(message(e)),
  });

  const pickFile = (lang: Lang, file: File | undefined) => {
    if (file && file.size > MAX_AUDIO_BYTES) {
      setFormError('Ses dosyası 10 MB’tan büyük olamaz.');
      return;
    }
    setFormError('');
    setForm((f) => ({ ...f, files: { ...f.files, [lang]: file } }));
  };

  const busy = save.isPending || remove.isPending;
  const text = hasRadius(form.roles);

  const cities = lookups?.cities ?? [{ id: 'bursa', slug: 'bursa', name: { tr: 'Bursa' } }];

  return (
    <>
      <PageHeader
        hint="Rotalar bu noktalardan hesaplanır: kullanıcı bir başlangıçtan hedefe giderken yakındaki anlatım noktalarına uğrar, yer işaretleri talimatlarda anılır."
        actions={
          <>
            <Select
              value={city}
              onValueChange={(v) => {
                setCity(v);
                reset();
              }}
            >
              <SelectTrigger aria-label="İl" className="min-w-36">
                <SelectValue placeholder="İl seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {cities.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name.tr}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button type="button" onClick={reset}>
              <Plus data-icon="inline-start" />
              Yeni nokta
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Noktalar alınamadı</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <div className="flex flex-col gap-6">
          <ToggleGroup
            type="single"
            variant="outline"
            value={filter}
            onValueChange={(v) => {
              if (v) setFilter(v as PointRole | 'all');
            }}
            aria-label="Role göre süz"
            className="flex-wrap justify-start gap-y-3"
          >
            <ToggleGroupItem value="all">
              Tümü
              <Badge variant="secondary" className="num ml-1">
                {points.length}
              </Badge>
            </ToggleGroupItem>
            {ROLES.map((r) => (
              <ToggleGroupItem key={r} value={r}>
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ROLE_COLOR[r] }} />
                {ROLE_LABEL[r]}
                <Badge variant="secondary" className="num ml-1">
                  {counts[r]}
                </Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Card>
            <CardHeader>
              <CardTitle>Harita</CardTitle>
              <CardDescription>
                Haritada boş yere tıklayınca yeni noktanın konumu seçilir; işaret sürüklenebilir. Soluk noktalar taslaktır, uygulamada görünmez.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PointsMap
                points={visible}
                selectedId={form.id}
                draft={form.id && current ? null : form.point}
                draftRadius={text ? form.radius : null}
                center={center}
                onSelect={(id) => {
                  const r = points.find((p) => p.id === id);
                  if (r) select(r);
                }}
                onPick={(p) => setForm((f) => ({ ...f, point: p }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nokta listesi</CardTitle>
              <CardDescription>Düzenlemek için listeden ya da haritadan bir noktaya tıklayın.</CardDescription>
              <CardAction>
                <Badge variant="secondary" className="num">
                  {visible.length} nokta
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : visible.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Signpost />
                    </EmptyMedia>
                    <EmptyTitle>Nokta bulunamadı</EmptyTitle>
                    <EmptyDescription>Bu ilde bu türde nokta yok.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad</TableHead>
                      <TableHead>Roller</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Ses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((p) => (
                      <TableRow
                        key={p.id}
                        tabIndex={0}
                        aria-selected={p.id === form.id}
                        data-state={p.id === form.id ? 'selected' : undefined}
                        className="cursor-pointer"
                        onClick={() => select(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            select(p);
                          }
                        }}
                      >
                        <TableCell className="font-semibold">
                          <div className="flex items-center gap-2">
                            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ROLE_COLOR[primaryRole(p.roles)] }} />
                            <span>{p.title.tr}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.roles.map((r) => (
                              <Badge key={r} variant="outline" className="gap-1.5">
                                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: ROLE_COLOR[r] }} />
                                {ROLE_LABEL[r]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell
                          aria-label={[p.audio_tr ? 'Türkçe ses var' : null, p.audio_en ? 'İngilizce ses var' : null].filter(Boolean).join(', ') || 'Ses yok'}
                        >
                          {p.audio_tr || p.audio_en ? (
                            <div className="flex items-center gap-1">
                              <Volume2 className="size-3.5 text-muted-foreground" aria-hidden />
                              <span>{[p.audio_tr ? 'TR' : null, p.audio_en ? 'EN' : null].filter(Boolean).join(' · ')}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <CardHeader>
              <CardTitle>{form.id ? 'Noktayı düzenle' : 'Yeni nokta'}</CardTitle>
              <CardDescription className="num flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                Konum: {form.point ? `${form.point[1]}, ${form.point[0]}` : 'seçilmedi (haritaya tıklayın)'}
              </CardDescription>
              {form.id ? (
                <CardAction>
                  <StatusBadge status={form.status} />
                </CardAction>
              ) : null}
            </CardHeader>

            <CardContent>
              <FieldGroup>
                <FieldSet>
                  <FieldLegend variant="label">Roller</FieldLegend>
                  <FieldGroup data-slot="checkbox-group">
                    {ROLES.map((r) => (
                      <Field key={r} orientation="horizontal">
                        <Checkbox id={`role-${r}`} checked={form.roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                        <FieldContent>
                          <FieldLabel htmlFor={`role-${r}`}>
                            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: ROLE_COLOR[r] }} />
                            {ROLE_LABEL[r]}
                          </FieldLabel>
                          <FieldDescription>{ROLE_HINT[r]}</FieldDescription>
                        </FieldContent>
                      </Field>
                    ))}
                  </FieldGroup>
                </FieldSet>

                {/* Varışta zorunlu; diğer rollerde isteğe bağlı: yürüyüşte nokta açılınca eserin kısa bilgisi ve sayfası. */}
                <Field>
                  <FieldLabel>{form.roles.includes('arrival') ? 'Eser' : 'Bağlı eser (isteğe bağlı)'}</FieldLabel>
                  {!form.roles.includes('arrival') ? (
                    <FieldDescription>
                      Noktanın anlattığı ya da yanında durduğu eser: yürüyüşte nokta açılınca eserin fotoğrafı ve kısa bilgisi gösterilir.
                    </FieldDescription>
                  ) : null}
                  {form.work ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                      <span className="truncate font-semibold">{form.work.name}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, work: null })}>
                        <X data-icon="inline-start" />
                        {form.roles.includes('arrival') ? 'Değiştir' : 'Kaldır'}
                      </Button>
                    </div>
                  ) : (
                    <Command shouldFilter={false} className="rounded-lg border">
                      <CommandInput value={workQuery} onValueChange={setWorkQuery} placeholder="Eser adı yazın" aria-label="Eser ara" />
                      {workHits.length > 0 ? (
                        <CommandList>
                          <CommandGroup>
                            {workHits.map((w) => (
                              <CommandItem key={w.id} value={w.id} onSelect={() => void chooseWork(w)}>
                                <span className="font-medium">{w.name.tr}</span>
                                <span className="text-muted-foreground">· {w.type_name.tr}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      ) : workQuery.trim() ? (
                        <CommandEmpty>Eşleşen eser bulunamadı.</CommandEmpty>
                      ) : null}
                    </Command>
                  )}
                </Field>

                <Tabs defaultValue="tr">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Başlık ve anlatım metni</FieldLabel>
                    <TabsList>
                      <TabsTrigger value="tr">Türkçe (TR)</TabsTrigger>
                      <TabsTrigger value="en">İngilizce (EN)</TabsTrigger>
                    </TabsList>
                  </div>
                  {LANGS.map((l) => (
                    <TabsContent key={l} value={l}>
                      <FieldGroup>
                        <Field>
                          <FieldLabel htmlFor={`point-title-${l}`}>Ad ({l.toUpperCase()})</FieldLabel>
                          <Input
                            id={`point-title-${l}`}
                            value={form.title[l]}
                            onChange={(e) => setForm({ ...form, title: { ...form.title, [l]: e.target.value } })}
                          />
                        </Field>
                        {text ? (
                          <Field>
                            <FieldLabel htmlFor={`point-body-${l}`}>Metin ({l.toUpperCase()})</FieldLabel>
                            <Textarea
                              id={`point-body-${l}`}
                              rows={4}
                              value={form.body[l]}
                              onChange={(e) => setForm({ ...form, body: { ...form.body, [l]: e.target.value } })}
                            />
                          </Field>
                        ) : null}
                      </FieldGroup>
                    </TabsContent>
                  ))}
                </Tabs>

                {text ? (
                  <Field>
                    <FieldLabel htmlFor="point-radius">Yarıçap (m): yaklaşınca açılma mesafesi</FieldLabel>
                    <FieldDescription>5 ile 200 metre arasında değer girin.</FieldDescription>
                    <Input
                      id="point-radius"
                      type="number"
                      min={5}
                      max={200}
                      className="num"
                      value={form.radius}
                      onChange={(e) => setForm({ ...form, radius: Number(e.target.value) })}
                    />
                  </Field>
                ) : null}

                {form.roles.includes('landmark') ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>Belirginlik</FieldLabel>
                      <Select value={String(form.salience)} onValueChange={(v) => setForm({ ...form, salience: Number(v) })}>
                        <SelectTrigger aria-label="Belirginlik" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="1">1 · Az görünür</SelectItem>
                            <SelectItem value="2">2 · Görünür</SelectItem>
                            <SelectItem value="3">3 · Uzaktan görünür</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Ortam sesi</FieldLabel>
                      <Select
                        value={form.ambient || 'none'}
                        onValueChange={(v) => setForm({ ...form, ambient: v === 'none' ? '' : (v as Ambient) })}
                      >
                        <SelectTrigger aria-label="Ortam sesi" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="none">Yok</SelectItem>
                            {(Object.keys(AMBIENT_LABEL) as Ambient[]).map((a) => (
                              <SelectItem key={a} value={a}>
                                {AMBIENT_LABEL[a]}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                ) : null}

                {form.roles.includes('start') ? (
                  <Field>
                    <FieldLabel htmlFor="point-sort-order">Başlangıç listesindeki sıra (en küçük varsayılan)</FieldLabel>
                    <Input
                      id="point-sort-order"
                      type="number"
                      className="num"
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                    />
                  </Field>
                ) : null}

                <div className="grid items-end gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Durum</FieldLabel>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}>
                      <SelectTrigger aria-label="Durum" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field orientation="horizontal" className="pb-1.5">
                    <Switch
                      id="point-field-checked"
                      checked={form.fieldChecked}
                      onCheckedChange={(checked) => setForm({ ...form, fieldChecked: checked })}
                    />
                    <FieldLabel htmlFor="point-field-checked">Sahada doğrulandı</FieldLabel>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="point-source-note">Kaynak notu (metnin ve konumun kaynağı)</FieldLabel>
                  <Textarea
                    id="point-source-note"
                    rows={3}
                    value={form.sourceNote}
                    onChange={(e) => setForm({ ...form, sourceNote: e.target.value })}
                  />
                </Field>

                {text
                  ? LANGS.map((l) => (
                      <AudioField
                        key={l}
                        lang={l}
                        path={l === 'tr' ? current?.audio_tr : current?.audio_en}
                        file={form.files[l]}
                        removed={form.removed[l]}
                        rev={form.rev}
                        onRemove={() => setForm({ ...form, removed: { ...form.removed, [l]: true } })}
                        onUndo={() => setForm({ ...form, removed: { ...form.removed, [l]: false } })}
                        onPick={(f) => pickFile(l, f)}
                      />
                    ))
                  : null}

                {formError ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>Kayıt hatası</AlertTitle>
                    <AlertDescription>{formError}</AlertDescription>
                  </Alert>
                ) : null}
              </FieldGroup>
            </CardContent>

            <CardFooter className="justify-between gap-2">
              <Button type="submit" disabled={busy}>
                {save.isPending ? <Spinner data-icon="inline-start" /> : null}
                {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
              </Button>
              {current ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive" disabled={busy}>
                      <Trash2 data-icon="inline-start" />
                      Sil
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Nokta silinsin mi?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{current.title.tr}” noktası ve varsa ses kayıtları kalıcı olarak silinecek. Bu işlem geri alınamaz.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={() => remove.mutate(current)}>
                        Sil
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </CardFooter>
          </form>
        </Card>
      </div>
    </>
  );
}
