import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, CircleAlert, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { slugify, tr, useCitiesAdmin, type CityRow } from '@/lib/data';
import { supabase } from '@/lib/supabase';

type InventoryStatus = NonNullable<CityRow['inventory_status']>;

const STATUS: Record<InventoryStatus, string> = {
  published: 'Yayımlandı',
  printing: 'Baskıda',
  in_progress: 'Çalışma sürüyor',
  planned: 'Planlandı',
};

const STATUS_VARIANT: Record<InventoryStatus, 'success' | 'warning' | 'secondary' | 'outline'> = {
  published: 'success',
  printing: 'warning',
  in_progress: 'secondary',
  planned: 'outline',
};

type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; city: CityRow }
  | null;

/**
 * İller: yeni il eklemek kod gerektirmez. Pasif il uygulamada görünmez; eserleri girildikçe yayına alınır.
 */
export function Cities() {
  const { data, isLoading, error, refetch } = useCitiesAdmin();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<DialogState>(null);

  const toggle = useMutation({
    mutationFn: async (c: CityRow) => {
      const next = !c.is_active;
      const { error: e } = await supabase.from('cities').update({ is_active: next }).eq('id', c.id);
      if (e) throw e;
      return { name: tr(c.name), active: next };
    },
    onSuccess: ({ name, active }) => {
      void qc.invalidateQueries({ queryKey: ['cities-admin'] });
      void qc.invalidateQueries({ queryKey: ['lookups'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(active ? `${name} uygulamada yayına alındı.` : `${name} uygulamada gizlendi.`);
    },
    onError: (e) => {
      toast.error(`Durum güncellenemedi: ${e.message}`);
    },
  });

  const regionsById = Object.fromEntries((data?.regions ?? []).map((r) => [r.id, tr(r.name)]));
  const nextOrder = data ? Math.max(0, ...data.cities.map((c) => c.sort_order)) + 1 : 1;

  return (
    <>
      <PageHeader
        actions={
          data ? (
            <Button onClick={() => setDialog({ mode: 'create' })}>
              <Plus data-icon="inline-start" />
              Yeni il ekle
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>İller alınamadı</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : data && data.cities.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Henüz kayıtlı il yok</EmptyTitle>
            <EmptyDescription>Envanter yeni bir ile genişlediğinde buradan ekleyebilirsiniz.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data ? (
        <Card>
          <CardHeader>
            <CardTitle>Envanter illeri</CardTitle>
            <CardDescription>
              Uygulamadaki il seçicisinde yalnızca yayındaki iller görünür. Envanter kapsamını ve yayın durumunu buradan güncelleyebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-right">Sıra</TableHead>
                  <TableHead>İl</TableHead>
                  <TableHead>Bölge</TableHead>
                  <TableHead>Envanter durumu</TableHead>
                  <TableHead className="text-right">Envanter kapsamı</TableHead>
                  <TableHead className="text-right">Kayıtlı eser</TableHead>
                  <TableHead>Uygulamada</TableHead>
                  <TableHead className="text-right">İşlem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cities.map((c) => {
                  const registeredWorks = data.workCount.get(c.slug) ?? 0;
                  const switchId = `city-active-${c.id}`;
                  const isToggling = toggle.isPending && toggle.variables?.id === c.id;

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="num text-right text-muted-foreground">{c.sort_order}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{tr(c.name)}</span>
                          <span className="text-xs text-muted-foreground">{c.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{regionsById[c.region_id] ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {c.inventory_status ? (
                            <Badge variant={STATUS_VARIANT[c.inventory_status]}>{STATUS[c.inventory_status]}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {c.inventory_year ? <span className="num text-xs text-muted-foreground">{c.inventory_year}</span> : null}
                        </div>
                      </TableCell>
                      <TableCell className="num text-right text-muted-foreground">
                        {[
                          c.inventory_works !== null ? `${c.inventory_works.toLocaleString('tr-TR')} eser` : null,
                          c.inventory_photos !== null ? `${c.inventory_photos.toLocaleString('tr-TR')} fotoğraf` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </TableCell>
                      <TableCell className="num text-right font-medium">{registeredWorks.toLocaleString('tr-TR')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={switchId}
                            checked={c.is_active}
                            disabled={isToggling}
                            onCheckedChange={() => toggle.mutate(c)}
                            aria-label={`${tr(c.name)} uygulamada görünsün`}
                          />
                          <Label htmlFor={switchId} className="cursor-pointer text-sm font-normal">
                            {c.is_active ? 'Yayında' : 'Gizli'}
                          </Label>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setDialog({ mode: 'edit', city: c })}>
                          <Pencil data-icon="inline-start" />
                          Düzenle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {data && dialog ? (
        <CityFormDialog
          key={dialog.mode === 'edit' ? dialog.city.id : 'create'}
          state={dialog}
          regions={data.regions}
          nextOrder={nextOrder}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

function CityFormDialog({
  state,
  regions,
  nextOrder,
  onClose,
}: {
  state: NonNullable<DialogState>;
  regions: { id: string; name: { tr: string; en?: string } }[];
  nextOrder: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const editing = state.mode === 'edit' ? state.city : null;

  const [name, setName] = useState({
    tr: editing?.name.tr ?? '',
    en: editing?.name.en ?? '',
  });
  const [region, setRegion] = useState(editing?.region_id ?? regions[0]?.id ?? '');
  const [sortOrder, setSortOrder] = useState(String(editing?.sort_order ?? nextOrder));
  const [year, setYear] = useState(editing?.inventory_year ? String(editing.inventory_year) : '');
  const [worksCount, setWorksCount] = useState(editing?.inventory_works !== null && editing?.inventory_works !== undefined ? String(editing.inventory_works) : '');
  const [photosCount, setPhotosCount] = useState(editing?.inventory_photos !== null && editing?.inventory_photos !== undefined ? String(editing.inventory_photos) : '');
  const [status, setStatus] = useState<InventoryStatus>(editing?.inventory_status ?? 'planned');
  const [isActive, setIsActive] = useState(editing?.is_active ?? false);
  const [problem, setProblem] = useState('');

  const nameMissing = problem.includes('İl adı');
  const yearInvalid = problem.includes('Envanter yılı');

  const save = useMutation({
    mutationFn: async () => {
      if (!name.tr.trim()) throw new Error('İl adı zorunlu.');
      const y = year.trim() ? Number(year.trim()) : null;
      if (y !== null && (!Number.isInteger(y) || y < 2000 || y > 2100)) {
        throw new Error('Envanter yılı 2000–2100 arasında olmalı.');
      }
      const ord = sortOrder.trim() ? Number(sortOrder.trim()) : nextOrder;
      if (!Number.isInteger(ord) || ord < 0) {
        throw new Error('Sıra numarası geçerli bir tam sayı olmalı.');
      }
      const invWorks = worksCount.trim() ? Number(worksCount.trim()) : null;
      if (invWorks !== null && (!Number.isInteger(invWorks) || invWorks < 0)) {
        throw new Error('Envanter eser sayısı geçerli bir tam sayı olmalı.');
      }
      const invPhotos = photosCount.trim() ? Number(photosCount.trim()) : null;
      if (invPhotos !== null && (!Number.isInteger(invPhotos) || invPhotos < 0)) {
        throw new Error('Envanter fotoğraf sayısı geçerli bir tam sayı olmalı.');
      }

      const payload = {
        name: { tr: name.tr.trim(), en: name.en.trim() || name.tr.trim() },
        region_id: region,
        is_active: isActive,
        sort_order: ord,
        inventory_year: y,
        inventory_works: invWorks,
        inventory_photos: invPhotos,
        inventory_status: status,
      };

      if (editing) {
        const { error } = await supabase.from('cities').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cities').insert({
          ...payload,
          slug: slugify(name.tr),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cities-admin'] });
      void qc.invalidateQueries({ queryKey: ['lookups'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? `${name.tr.trim()} bilgileri kaydedildi.` : `${name.tr.trim()} ili eklendi.`);
      onClose();
    },
    onError: (e) => {
      setProblem(e.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setProblem('');
    save.mutate();
  };

  const previewSlug = editing ? editing.slug : slugify(name.tr) || '—';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `${tr(editing.name)} ilini düzenle` : 'Yeni il ekle'}</DialogTitle>
          <DialogDescription>
            {editing
              ? `Kısa ad: ${editing.slug}. Envanter kapsamı ve görünürlük ayarlarını güncelleyin.`
              : 'Yeni il varsayılan olarak gizli eklenir; eserleri hazır olduğunda yayına alabilirsiniz.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={nameMissing || undefined}>
                <FieldLabel htmlFor="city-tr">Ad (TR) *</FieldLabel>
                <Input
                  id="city-tr"
                  value={name.tr}
                  aria-invalid={nameMissing || undefined}
                  onChange={(e) => setName({ ...name, tr: e.target.value })}
                  placeholder="Örn. Edirne"
                />
                <FieldDescription>Kısa ad: {previewSlug}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="city-en">Ad (EN)</FieldLabel>
                <Input
                  id="city-en"
                  value={name.en}
                  onChange={(e) => setName({ ...name, en: e.target.value })}
                  placeholder={name.tr || 'Örn. Edirne'}
                />
                <FieldDescription>Boş bırakılırsa Türkçe ad kullanılır.</FieldDescription>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="city-region">Bölge</FieldLabel>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="city-region">
                    <SelectValue placeholder="Bölge seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {tr(r.name)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="city-order">Sıra</FieldLabel>
                <Input
                  id="city-order"
                  inputMode="numeric"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="city-status">Envanter durumu</FieldLabel>
                <Select value={status} onValueChange={(v) => setStatus(v as InventoryStatus)}>
                  <SelectTrigger id="city-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(STATUS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={yearInvalid || undefined}>
                <FieldLabel htmlFor="city-year">Envanter yılı</FieldLabel>
                <Input
                  id="city-year"
                  inputMode="numeric"
                  value={year}
                  aria-invalid={yearInvalid || undefined}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Örn. 2025"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="city-works">Envanterdeki eser sayısı</FieldLabel>
                <Input
                  id="city-works"
                  inputMode="numeric"
                  value={worksCount}
                  onChange={(e) => setWorksCount(e.target.value)}
                  placeholder="Örn. 385"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="city-photos">Envanterdeki fotoğraf sayısı</FieldLabel>
                <Input
                  id="city-photos"
                  inputMode="numeric"
                  value={photosCount}
                  onChange={(e) => setPhotosCount(e.target.value)}
                  placeholder="Örn. 15200"
                />
              </Field>
            </div>

            <Field orientation="horizontal" className="items-center justify-between rounded-lg border p-3">
              <FieldContent>
                <FieldLabel htmlFor="city-active-switch">Uygulamada görünür</FieldLabel>
                <FieldDescription>Açık olduğunda bu il mobil uygulamanın il seçicisinde listelenir.</FieldDescription>
              </FieldContent>
              <Switch id="city-active-switch" checked={isActive} onCheckedChange={setIsActive} />
            </Field>

            {problem ? <FieldError>{problem}</FieldError> : null}
          </FieldGroup>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Vazgeç
              </Button>
            </DialogClose>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner data-icon="inline-start" /> : null}
              {editing ? 'Kaydet' : 'İli ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
