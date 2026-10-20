import { ChevronLeft, ChevronRight, CircleAlert, ImageIcon, Landmark, Plus, RotateCcw, Search, X } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mediaUrl, PAGE_SIZE, PRECISION_LABEL, tr, useLookups, useWorkList, type Precision, type WorkFilters } from '@/lib/data';

const KEYS: (keyof WorkFilters)[] = ['q', 'city', 'type', 'status', 'precision', 'review', 'photo'];
const ALL = '__all__';

const PRECISION_VARIANT: Record<Precision, 'secondary' | 'outline' | 'warning'> = {
  exact: 'secondary',
  approximate: 'outline',
  unknown: 'warning',
};

/** Sayfalama çubuğunda gösterilecek sayfa numaraları (0 tabanlı). */
function pageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const items: (number | 'ellipsis')[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);
  if (start > 1) items.push('ellipsis');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 2) items.push('ellipsis');
  items.push(total - 1);
  return items;
}

/** Eser listesi: süzgeçler adres çubuğunda tutulur (geri dönüşte kaybolmaz, bağlantı paylaşılabilir). */
export function Works() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const f: WorkFilters = {
    q: params.get('q') ?? '',
    city: params.get('city') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? '',
    precision: params.get('precision') ?? '',
    review: params.get('review') ?? '',
    photo: params.get('photo') ?? '',
    page: Math.max(0, Number(params.get('page') ?? 0) || 0),
  };

  const set = (key: keyof WorkFilters, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== ALL) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const clearFilters = () => setParams(new URLSearchParams(), { replace: true });

  const { data, isLoading, isFetching, error, refetch } = useWorkList(f);
  const { data: lookups } = useLookups();
  const count = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const activeCount = KEYS.filter((k) => Boolean(f[k])).length;
  const active = activeCount > 0;
  const rangeStart = count === 0 ? 0 : f.page * PAGE_SIZE + 1;
  const rangeEnd = Math.min(count, (f.page + 1) * PAGE_SIZE);

  return (
    <>
      <PageHeader
        actions={
          <Button asChild>
            <Link to="/eserler/yeni">
              <Plus data-icon="inline-start" />
              Yeni eser
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <span>Süzgeçler</span>
            {active ? <Badge variant="secondary">{activeCount} etkin</Badge> : null}
          </CardTitle>
          <CardAction className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground num" aria-live="polite">
              {isFetching ? <Spinner className="size-3.5" /> : null}
              {isLoading ? 'Yükleniyor…' : `${count.toLocaleString('tr-TR')} eser`}
            </span>
            {active ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <RotateCcw data-icon="inline-start" />
                Filtreleri temizle
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <Field className="sm:col-span-2 lg:col-span-2 xl:col-span-1">
              <FieldLabel htmlFor="filter-q">Ara</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <Search aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  id="filter-q"
                  value={f.q}
                  onChange={(e) => set('q', e.target.value)}
                  placeholder="Eser adı…"
                />
                {f.q ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" aria-label="Aramayı temizle" onClick={() => set('q', '')}>
                      <X />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-city">İl</FieldLabel>
              <Select value={f.city || ALL} onValueChange={(v) => set('city', v)}>
                <SelectTrigger id="filter-city" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    {lookups?.cities.map((c) => (
                      <SelectItem key={c.id} value={c.slug}>
                        {tr(c.name)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-type">Tür</FieldLabel>
              <Select value={f.type || ALL} onValueChange={(v) => set('type', v)}>
                <SelectTrigger id="filter-type" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    {lookups?.types.map((t) => (
                      <SelectItem key={t.id} value={t.slug}>
                        {tr(t.name)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-status">Durum</FieldLabel>
              <Select value={f.status || ALL} onValueChange={(v) => set('status', v)}>
                <SelectTrigger id="filter-status" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="verified">Doğrulandı</SelectItem>
                    <SelectItem value="archived">Arşivde</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-precision">Konum kesinliği</FieldLabel>
              <Select value={f.precision || ALL} onValueChange={(v) => set('precision', v)}>
                <SelectTrigger id="filter-precision" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    <SelectItem value="exact">Kesin</SelectItem>
                    <SelectItem value="approximate">Yaklaşık</SelectItem>
                    <SelectItem value="unknown">Yok</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-photo">Fotoğraf</FieldLabel>
              <Select value={f.photo || ALL} onValueChange={(v) => set('photo', v)}>
                <SelectTrigger id="filter-photo" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    <SelectItem value="with">Fotoğraflı</SelectItem>
                    <SelectItem value="without">Fotoğrafsız</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="filter-review">İnceleme</FieldLabel>
              <Select value={f.review || ALL} onValueChange={(v) => set('review', v)}>
                <SelectTrigger id="filter-review" className="w-full">
                  <SelectValue placeholder="Tümü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={ALL}>Tümü</SelectItem>
                    <SelectItem value="1">İnceleme bekleyen</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Liste alınamadı</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error.message}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="py-0">
        <CardContent className="px-0">
          {isLoading ? (
            <Table aria-label="Eserler yükleniyor">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 pl-4">Görsel</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Yer</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead className="pr-4">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell className="pl-4">
                      <Skeleton className="h-10 w-13 rounded-md" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="pr-4">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : data && data.rows.length === 0 ? (
            <Empty className="my-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Landmark />
                </EmptyMedia>
                <EmptyTitle>Eşleşen eser bulunamadı</EmptyTitle>
                <EmptyDescription>
                  {active
                    ? 'Seçili arama ya da filtre kriterlerine uyan eser yok. Filtreleri temizleyip tekrar deneyebilirsiniz.'
                    : 'Henüz kayıtlı eser bulunmuyor.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="flex-row justify-center gap-2">
                {active ? (
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    <RotateCcw data-icon="inline-start" />
                    Filtreleri temizle
                  </Button>
                ) : null}
                <Button asChild>
                  <Link to="/eserler/yeni">
                    <Plus data-icon="inline-start" />
                    Yeni eser
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 pl-4">
                    <span className="sr-only">Fotoğraf</span>
                  </TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Yer</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Konum</TableHead>
                  <TableHead className="pr-4">Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((w) => {
                  const inv = w.sources.find((s) => s.kind === 'inventory');
                  const photo = w.photos[0];
                  const typeLabel = tr(w.type_name);
                  const initial = typeLabel.trim().slice(0, 1).toLocaleUpperCase('tr-TR');
                  const detailHref = `/eserler/${w.slug}`;
                  return (
                    <TableRow
                      key={w.id}
                      tabIndex={0}
                      className="cursor-pointer focus-visible:bg-muted/60"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('a,button')) return;
                        navigate(detailHref);
                      }}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(detailHref);
                        }
                      }}>
                      <TableCell className="pl-4">
                        {photo ? (
                          <img
                            className="h-10 w-13 rounded-md border border-border bg-muted object-cover"
                            src={mediaUrl(photo.thumb ?? photo.path)}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-13 items-center justify-center rounded-md border border-border bg-muted font-heading text-xs font-bold text-muted-foreground"
                            aria-hidden>
                            {initial || <Landmark className="size-4" />}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            to={detailHref}
                            className="font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">
                            {tr(w.name)}
                          </Link>
                          {w.photos.length > 1 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground num" title={`${w.photos.length} fotoğraf`}>
                              <ImageIcon className="size-3" aria-hidden />
                              {w.photos.length}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{typeLabel}</TableCell>
                      <TableCell>{[w.district, tr(w.city_name)].filter(Boolean).join(', ')}</TableCell>
                      <TableCell className="text-muted-foreground num">
                        {inv?.page ? `${inv.volume ? `C${inv.volume} ` : ''}s. ${inv.page}` : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRECISION_VARIANT[w.location_precision]}>
                          {PRECISION_LABEL[w.location_precision]}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4">
                        <StatusBadge status={w.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {count > 0 ? (
          <CardFooter className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground num">
              {rangeStart.toLocaleString('tr-TR')}–{rangeEnd.toLocaleString('tr-TR')} / {count.toLocaleString('tr-TR')} eser · Sayfa {f.page + 1} / {pages}
            </span>
            <Pagination className="mx-0 w-auto">
              <PaginationContent>
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={f.page === 0}
                    onClick={() => set('page', String(f.page - 1))}>
                    <ChevronLeft data-icon="inline-start" />
                    Önceki
                  </Button>
                </PaginationItem>
                {pageNumbers(f.page, pages).map((p, idx) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${idx}`} className="hidden sm:block">
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p} className="hidden sm:block">
                      <PaginationLink
                        href={`?page=${p}`}
                        isActive={p === f.page}
                        onClick={(e) => {
                          e.preventDefault();
                          set('page', p === 0 ? '' : String(p));
                        }}>
                        {p + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={f.page + 1 >= pages}
                    onClick={() => set('page', String(f.page + 1))}>
                    Sonraki
                    <ChevronRight data-icon="inline-end" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        ) : null}
      </Card>
    </>
  );
}
