import type { LocalizedText } from '@sezi/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CircleAlert,
  ExternalLink,
  ImageOff,
  MapPinOff,
  RotateCcw,
  Star,
  Unlink,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';

import { AudioField } from '@/components/AudioField';
import { LocationMap } from '@/components/LocationMap';
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { LANGS, MAX_AUDIO_BYTES, removeAudio, uploadAudio, type Lang, type Uploaded } from '@/lib/audio';
import {
  CITY_CENTER,
  CONDITION_LABEL,
  localized,
  mediaUrl,
  tr,
  useLookups,
  useWork,
  type Condition,
  type MediaRow,
  type Precision,
  type Status,
  type WorkDetail,
  type WorkRecord,
} from '@/lib/data';
import { supabase } from '@/lib/supabase';

type TextKey = 'name' | 'period' | 'history' | 'architecture' | 'address' | 'condition_note';

interface Form {
  name: { tr: string; en: string };
  period: { tr: string; en: string };
  history: { tr: string; en: string };
  architecture: { tr: string; en: string };
  address: { tr: string; en: string };
  condition_note: { tr: string; en: string };
  work_type_id: string;
  district: string;
  condition: Condition;
  unesco: boolean;
  status: Status;
  needs_review: boolean;
  point: [number, number] | null;
  precision: Precision;
  /** Yeni seçilen ses dosyaları. */
  files: Partial<Record<Lang, File>>;
  /** Mevcut kayıtları kaldır. */
  removed: Record<Lang, boolean>;
  /** Kayıttan sonra artar: dosya alanları sıfırlanır. */
  rev: number;
}

const text = (t: LocalizedText | null | undefined) => ({ tr: t?.tr ?? '', en: t?.en ?? '' });

function toForm(w: WorkRecord, lng: number | null, lat: number | null): Form {
  return {
    name: text(w.name),
    period: text(w.period),
    history: text(w.history),
    architecture: text(w.architecture),
    address: text(w.address),
    condition_note: text(w.condition_note),
    work_type_id: w.work_type_id,
    district: w.district ?? '',
    condition: w.condition,
    unesco: w.unesco,
    status: w.status,
    needs_review: w.needs_review,
    point: lng !== null && lat !== null ? [lng, lat] : null,
    precision: w.location_precision,
    files: {},
    removed: { tr: false, en: false },
    rev: 0,
  };
}

function isFormDirty(a: Form, b: Form): boolean {
  const textKeys: TextKey[] = ['name', 'period', 'history', 'architecture', 'address', 'condition_note'];
  for (const k of textKeys) {
    if (a[k].tr !== b[k].tr || a[k].en !== b[k].en) return true;
  }
  if (
    a.work_type_id !== b.work_type_id ||
    a.district !== b.district ||
    a.condition !== b.condition ||
    a.unesco !== b.unesco ||
    a.status !== b.status ||
    a.needs_review !== b.needs_review ||
    a.precision !== b.precision
  ) {
    return true;
  }
  if ((a.point === null) !== (b.point === null)) return true;
  if (a.point && b.point && (a.point[0] !== b.point[0] || a.point[1] !== b.point[1])) return true;
  if (a.files.tr || a.files.en || a.removed.tr || a.removed.en) return true;
  return false;
}

export function WorkEdit() {
  const { slug = '' } = useParams();
  const { data, isLoading, error, refetch, dataUpdatedAt } = useWork(slug);
  if (isLoading) {
    return (
      <>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-72 rounded-xl" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
          <div className="flex flex-col gap-6">
            <Skeleton className="h-96 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader
          title="Eser düzenleme"
          actions={
            <Button variant="outline" asChild>
              <Link to="/eserler">
                <ArrowLeft data-icon="inline-start" />
                Eserler
              </Link>
            </Button>
          }
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Eser alınamadı</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error ? error.message : 'Eser bulunamadı.'}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }
  // Kayıttan sonra veri yenilenince form da sunucudaki son hâlle yeniden kurulur.
  return <Editor key={dataUpdatedAt} slug={slug} data={data} />;
}

function Editor({ slug, data }: { slug: string; data: WorkDetail }) {
  const { data: lookups } = useLookups();
  const qc = useQueryClient();
  const initialForm = useMemo(() => toForm(data.work, data.lng, data.lat), [data.work, data.lng, data.lat]);
  const [form, setForm] = useState<Form>(initialForm);
  const [fileError, setFileError] = useState('');

  const isDirty = useMemo(() => isFormDirty(form, initialForm), [form, initialForm]);
  const nameTrInvalid = !form.name.tr.trim();

  const cityLabel = useMemo(() => {
    const c = lookups?.cities.find((x) => x.id === data.work.city_id || x.slug === data.citySlug);
    return c ? tr(c.name) : data.citySlug;
  }, [lookups, data.work.city_id, data.citySlug]);

  const typeLabel = useMemo(() => {
    const t = lookups?.types.find((x) => x.id === form.work_type_id);
    return t ? tr(t.name) : '';
  }, [lookups, form.work_type_id]);

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['work', slug] });
    void qc.invalidateQueries({ queryKey: ['works'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
    void qc.invalidateQueries({ queryKey: ['inbox'] });
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.tr.trim()) throw new Error('Türkçe ad boş olamaz.');
      const old: Record<Lang, string | null> = { tr: data.work.audio_tr_id, en: data.work.audio_en_id };
      const audioIds = { ...old };
      const uploaded: Uploaded[] = [];
      try {
        for (const lang of LANGS) {
          const file = f.files[lang];
          if (file) audioIds[lang] = await uploadAudio(`works/${data.work.id}`, lang, file, `${f.name.tr.trim()} · ${lang.toUpperCase()}`, uploaded);
          else if (f.removed[lang]) audioIds[lang] = null;
        }
        const { error: e } = await supabase
          .from('works')
          .update({
            name: localized(f.name),
            period: localized(f.period),
            history: localized(f.history),
            architecture: localized(f.architecture),
            address: localized(f.address),
            condition_note: localized(f.condition_note),
            work_type_id: f.work_type_id,
            district: f.district.trim() || null,
            condition: f.condition,
            unesco: f.unesco,
            status: f.status,
            needs_review: f.needs_review,
            // PostGIS, metin olarak verilen EWKT'yi geography'ye çevirir.
            location: f.point ? `SRID=4326;POINT(${f.point[0]} ${f.point[1]})` : null,
            location_precision: f.point ? f.precision : 'unknown',
            audio_tr_id: audioIds.tr,
            audio_en_id: audioIds.en,
          })
          .eq('id', data.work.id);
        if (e) throw e;
      } catch (err) {
        await removeAudio(
          uploaded.map((u) => u.assetId).filter((x): x is string => !!x),
          uploaded.map((u) => u.path),
        );
        throw err;
      }
      // Kayıt geçerli; değiştirilen ya da kaldırılan eski sesleri temizle.
      const stale = LANGS.filter((lang) => old[lang] && audioIds[lang] !== old[lang]);
      return removeAudio(
        stale.map((lang) => old[lang]!),
        stale.map((lang) => data.audio[lang]).filter((p): p is string => !!p),
      );
    },
    onSuccess: (cleanupFailed) => {
      invalidateAll();
      setForm((f) => ({ ...f, files: {}, removed: { tr: false, en: false }, rev: f.rev + 1 }));
      if (cleanupFailed) toast.warning('Kaydedildi · Eski ses dosyası silinemedi.');
      else toast.success('Değişiklikler kaydedildi.');
    },
    onError: (err) => {
      toast.error(`Kaydedilemedi: ${err.message}`);
    },
  });

  const media = useMutation({
    mutationFn: async ({ row, patch }: { row: MediaRow; patch: Partial<MediaRow> & { work_id?: string | null } }) => {
      const { error: e } = await supabase.from('media').update(patch).eq('id', row.id);
      if (e) throw e;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fotoğraf güncellendi.');
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const setText = (k: TextKey, lang: Lang, v: string) => setForm({ ...form, [k]: { ...form[k], [lang]: v } });
  const inv = data.sources.find((s) => s.kind === 'inventory');

  const makeCover = async (row: MediaRow) => {
    // Seçilen fotoğraf başa, diğerleri mevcut sırasıyla arkasına.
    const order = [row, ...data.media.filter((m) => m.id !== row.id)];
    for (const [i, m] of order.entries()) await supabase.from('media').update({ sort_order: i }).eq('id', m.id);
    invalidateAll();
    toast.success('Kapak fotoğrafı güncellendi.');
  };

  return (
    <>
      <PageHeader
        title={form.name.tr || data.work.slug}
        hint={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{[cityLabel, typeLabel].filter(Boolean).join(' · ')}</span>
            <span>·</span>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{data.work.slug}</code>
            <StatusBadge status={data.work.status} />
            {data.work.needs_review ? <Badge variant="warning">İnceleme bekliyor</Badge> : null}
            {isDirty ? <Badge variant="outline">Kaydedilmemiş değişiklik var</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button type="button" variant="ghost" asChild>
              <Link to="/eserler">
                <ArrowLeft data-icon="inline-start" />
                Eserler
              </Link>
            </Button>
            {isDirty ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm({ ...initialForm, rev: form.rev + 1 });
                  setFileError('');
                }}
                disabled={save.isPending}>
                <RotateCcw data-icon="inline-start" />
                Geri al
              </Button>
            ) : null}
            {data.work.status !== 'verified' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => save.mutate({ ...form, status: 'verified', needs_review: false })}
                disabled={save.isPending || nameTrInvalid}>
                <Check data-icon="inline-start" />
                Doğrula ve yayımla
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => save.mutate({ ...form, status: 'draft' })}
                disabled={save.isPending || nameTrInvalid}>
                Taslağa al
              </Button>
            )}
            <Button type="button" onClick={() => save.mutate(form)} disabled={save.isPending || nameTrInvalid}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              {save.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      />

      {save.error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Kaydedilemedi</AlertTitle>
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Kimlik</CardTitle>
              <CardDescription>Eserin adı, türü, ilçesi ve açık adresi.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Pair
                  idPrefix="name"
                  label="Ad"
                  value={form.name}
                  onChange={(l, v) => setText('name', l, v)}
                  requiredTr
                  invalidTr={nameTrInvalid}
                  errorTr="Türkçe ad boş olamaz."
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="work-type">Tür</FieldLabel>
                    <Select value={form.work_type_id} onValueChange={(v) => set('work_type_id', v)}>
                      <SelectTrigger id="work-type" className="w-full">
                        <SelectValue placeholder="Tür seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {lookups?.types.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {tr(t.name)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="work-district">İlçe</FieldLabel>
                    <Input
                      id="work-district"
                      value={form.district}
                      onChange={(e) => set('district', e.target.value)}
                      placeholder="İlçe"
                    />
                  </Field>
                </div>
                <Pair idPrefix="address" label="Adres" value={form.address} onChange={(l, v) => setText('address', l, v)} />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metinler (TR / EN)</CardTitle>
              <CardDescription>
                Tarihçe, mimari ve dönem bilgisi ancak kaynağıyla girilir. Envanter kitaplarından çıkarılan taslaklar “Eser metinleri” sayfasında kitap sayfasıyla karşılaştırılıp yayınlanır.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/metinler?city=${data.citySlug}&work=${data.work.slug}`}>
                    Kitaptan metin taslağına git
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Pair idPrefix="period" label="Dönem" value={form.period} onChange={(l, v) => setText('period', l, v)} />
                <Pair
                  idPrefix="history"
                  label="Tarihçe"
                  value={form.history}
                  onChange={(l, v) => setText('history', l, v)}
                  multiline
                />
                <Pair
                  idPrefix="architecture"
                  label="Mimari"
                  value={form.architecture}
                  onChange={(l, v) => setText('architecture', l, v)}
                  multiline
                />
                <div className="grid items-end gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="work-condition">Bugünkü durum</FieldLabel>
                    <Select value={form.condition} onValueChange={(v) => set('condition', v as Condition)}>
                      <SelectTrigger id="work-condition" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(Object.keys(CONDITION_LABEL) as Condition[]).map((c) => (
                            <SelectItem key={c} value={c}>
                              {CONDITION_LABEL[c]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal" className="rounded-lg border border-border p-2.5">
                    <Checkbox
                      id="work-unesco"
                      checked={form.unesco}
                      onCheckedChange={(checked) => set('unesco', checked === true)}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="work-unesco">UNESCO Dünya Mirası</FieldLabel>
                      <FieldDescription>Alan ya da eser UNESCO listesindeyse işaretleyin.</FieldDescription>
                    </FieldContent>
                  </Field>
                </div>
                <Pair
                  idPrefix="condition-note"
                  label="Durum notu"
                  value={form.condition_note}
                  onChange={(l, v) => setText('condition_note', l, v)}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Yayın ve inceleme</CardTitle>
              <CardDescription>Mobil uygulamada yalnızca “Doğrulandı” durumundaki eserler görünür.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="work-status">İçerik durumu</FieldLabel>
                    <Select value={form.status} onValueChange={(v) => set('status', v as Status)}>
                      <SelectTrigger id="work-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="draft">Taslak (uygulamada görünmez)</SelectItem>
                          <SelectItem value="verified">Doğrulandı (uygulamada görünür)</SelectItem>
                          <SelectItem value="archived">Arşivde</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal" className="rounded-lg border border-border p-2.5">
                    <Checkbox
                      id="work-needs-review"
                      checked={form.needs_review}
                      onCheckedChange={(checked) => set('needs_review', checked === true)}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="work-needs-review">İnceleme bekliyor</FieldLabel>
                      <FieldDescription>Bilgileri kitapla tekrar kontrol edilecek eserler için işaretlenir.</FieldDescription>
                    </FieldContent>
                  </Field>
                </div>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Konum</CardTitle>
              <CardDescription>
                Haritaya tıklayın ya da iğneyi sürükleyin. Sahada ya da güvenilir haritada doğruladığınız konum için “Kesin” seçin.
              </CardDescription>
              <CardAction>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/eslestirme?city=${data.citySlug}&work=${data.work.slug}`}>
                    Konum adayları
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <LocationMap
                value={form.point}
                fallbackCenter={CITY_CENTER[data.citySlug] ?? CITY_CENTER.bursa}
                onChange={(p) =>
                  setForm({ ...form, point: p, precision: form.precision === 'unknown' ? 'exact' : form.precision })
                }
              />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <Field className="min-w-44 flex-1">
                  <FieldLabel htmlFor="work-precision">Kesinlik</FieldLabel>
                  <Select
                    value={form.point ? form.precision : 'unknown'}
                    disabled={!form.point}
                    onValueChange={(v) => set('precision', v as Precision)}>
                    <SelectTrigger id="work-precision" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="exact">Kesin</SelectItem>
                        <SelectItem value="approximate">Yaklaşık</SelectItem>
                        <SelectItem value="unknown">Yok</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {form.point ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="h-8 px-2.5 text-xs num">
                      {form.point[1].toFixed(5)}, {form.point[0].toFixed(5)}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="outline" size="default">
                          <MapPinOff data-icon="inline-start" />
                          Konumu kaldır
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Konum kaldırılsın mı?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Eserin harita koordinatı temizlenecek ve konum kesinliği “Yok” olarak işaretlenecek.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() => setForm({ ...form, point: null, precision: 'unknown' })}>
                            Konumu kaldır
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ses kaydı</CardTitle>
              <CardDescription>
                Yüklenen kayıt uygulamada metin okuması yerine çalar. Kaydın içeriği de kaynağıyla girilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <FieldGroup>
                {LANGS.map((l) => (
                  <AudioField
                    key={l}
                    lang={l}
                    path={data.audio[l]}
                    file={form.files[l]}
                    removed={form.removed[l]}
                    rev={form.rev}
                    onRemove={() => setForm({ ...form, removed: { ...form.removed, [l]: true } })}
                    onUndo={() => setForm({ ...form, removed: { ...form.removed, [l]: false } })}
                    onPick={(file) => {
                      if (file && file.size > MAX_AUDIO_BYTES) {
                        setFileError('Ses dosyası 10 MB’tan büyük olamaz.');
                        toast.error('Ses dosyası 10 MB’tan büyük olamaz.');
                        return;
                      }
                      setFileError('');
                      setForm((f) => ({ ...f, files: { ...f.files, [l]: file } }));
                    }}
                  />
                ))}
              </FieldGroup>
              {fileError ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Geçersiz dosya</AlertTitle>
                  <AlertDescription>{fileError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Fotoğraflar</span>
                <Badge variant="secondary" className="num">
                  {data.media.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Taslak fotoğraflar uygulamada görünmez. Eşleşmeyi kitaptaki sayfayla karşılaştırıp onaylayın.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.media.length === 0 ? (
                <Empty className="py-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ImageOff />
                    </EmptyMedia>
                    <EmptyTitle>Bu esere bağlı fotoğraf yok</EmptyTitle>
                    <EmptyDescription>Fotoğraf kutusundan bu esere fotoğraf bağlayabilirsiniz.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-3">
                  {data.media.map((m, i) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2.5">
                      <a
                        href={mediaUrl(m.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="group relative block overflow-hidden rounded-lg border border-border bg-muted">
                        <img
                          src={mediaUrl(m.thumb_path ?? m.storage_path)}
                          alt={tr(m.alt_text) || `${form.name.tr} fotoğraf ${i + 1}`}
                          loading="lazy"
                          className="aspect-4/3 w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </a>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={m.status} />
                        {i === 0 ? <Badge variant="secondary">Kapak</Badge> : null}
                        {m.origin === 'commons' ? <Badge variant="secondary">Commons</Badge> : null}
                      </div>
                      {m.origin === 'commons' ? (
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                          <span
                            className="line-clamp-2"
                            title={[m.author || 'Yazar belirtilmemiş', m.license].filter(Boolean).join(' · ')}>
                            {[m.author || 'Yazar belirtilmemiş', m.license].filter(Boolean).join(' · ')}
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {m.source_url ? (
                              <a
                                href={m.source_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                                aria-label="Wikimedia Commons dosya sayfası">
                                <span>Commons</span>
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                            {m.wikidata_id ? (
                              <a
                                href={`https://www.wikidata.org/wiki/${m.wikidata_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-0.5 text-muted-foreground hover:underline"
                                aria-label={`Wikidata maddesi ${m.wikidata_id}`}>
                                <span>{m.wikidata_id}</span>
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground num">
                          {m.source_page ? `Kitap: C${m.source_volume ?? '?'} s. ${m.source_page}` : 'Kitapta bulunamadı'}
                        </span>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
                        {m.status !== 'verified' ? (
                          <Button
                            type="button"
                            size="xs"
                            disabled={media.isPending}
                            onClick={() => media.mutate({ row: m, patch: { status: 'verified' } })}>
                            Onayla
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={media.isPending}
                            onClick={() => media.mutate({ row: m, patch: { status: 'draft' } })}>
                            Gizle
                          </Button>
                        )}
                        {i > 0 ? (
                          <Button type="button" variant="ghost" size="xs" onClick={() => void makeCover(m)}>
                            <Star data-icon="inline-start" />
                            Kapak yap
                          </Button>
                        ) : null}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              aria-label="Fotoğraf bağlantısını kaldır"
                              title="Fotoğraf bağlantısını kaldır">
                              <Unlink data-icon="inline-start" />
                              Ayır
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Fotoğraf eserden ayrılsın mı?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Fotoğraf silinmez; bu eserle bağlantısı kaldırılır ve yeniden eşleştirilmek üzere fotoğraf kutusuna döner.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                onClick={() => media.mutate({ row: m, patch: { work_id: null, status: 'draft' } })}>
                                Eserden ayır
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kaynaklar</CardTitle>
              {inv?.page ? <CardDescription>Kontrol için: kitapta {inv.page}. sayfa.</CardDescription> : null}
            </CardHeader>
            <CardContent>
              {data.sources.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu esere ait kaynak kaydı yok.</p>
              ) : (
                <ItemGroup className="gap-2">
                  {data.sources.map((s) => {
                    const meta = [s.volume ? `Cilt ${s.volume}` : null, s.page ? `s. ${s.page}` : null]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <Item key={`${s.title}-${s.page}`} variant="outline" size="sm">
                        <ItemMedia variant="icon">
                          <BookOpen />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{s.title}</ItemTitle>
                          {meta ? <ItemDescription className="num">{meta}</ItemDescription> : null}
                        </ItemContent>
                        {s.url ? (
                          <ItemActions>
                            <Button variant="outline" size="xs" asChild>
                              <a href={s.url} target="_blank" rel="noreferrer">
                                Kitabı aç
                                <ExternalLink data-icon="inline-end" />
                              </a>
                            </Button>
                          </ItemActions>
                        ) : null}
                      </Item>
                    );
                  })}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** TR ve EN alanı yan yana: aynı içeriğin iki dili birlikte düzenlenir. */
function Pair({
  idPrefix,
  label,
  value,
  onChange,
  multiline,
  requiredTr,
  invalidTr,
  errorTr,
}: {
  idPrefix: string;
  label: string;
  value: { tr: string; en: string };
  onChange: (lang: Lang, v: string) => void;
  multiline?: boolean;
  requiredTr?: boolean;
  invalidTr?: boolean;
  errorTr?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(['tr', 'en'] as Lang[]).map((l) => {
        const id = `${idPrefix}-${l}`;
        const isInvalid = l === 'tr' && Boolean(invalidTr);
        return (
          <Field key={l} data-invalid={isInvalid || undefined}>
            <FieldLabel htmlFor={id}>
              {label} ({l.toUpperCase()}){l === 'tr' && requiredTr ? ' *' : ''}
            </FieldLabel>
            {multiline ? (
              <Textarea
                id={id}
                value={value[l]}
                rows={5}
                aria-invalid={isInvalid || undefined}
                onChange={(e) => onChange(l, e.target.value)}
              />
            ) : (
              <Input
                id={id}
                value={value[l]}
                aria-invalid={isInvalid || undefined}
                onChange={(e) => onChange(l, e.target.value)}
              />
            )}
            {isInvalid && errorTr ? <FieldError>{errorTr}</FieldError> : null}
          </Field>
        );
      })}
    </div>
  );
}
