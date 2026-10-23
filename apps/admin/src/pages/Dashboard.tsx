import { ArrowRight, Check, CircleAlert, Minus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboard, type CityStats, type Dashboard as Data } from '@/lib/dashboard';
import { NAV } from '@/lib/nav';

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
const fmt = (n: number) => n.toLocaleString('tr-TR');

export function Dashboard() {
  const { data, isPending, error, refetch } = useDashboard();
  if (error) {
    return (
      <>
        <PageHeader />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Pano yüklenemedi</AlertTitle>
          <AlertDescription>
            {error.message}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void refetch()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }
  if (isPending) return <DashboardSkeleton />;
  return (
    <>
      <PageHeader />
      <Kpis d={data} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <CityChart cities={data.cities} />
        <Queue d={data} />
      </div>
      <CityTable d={data} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PhotoChart d={data} />
        <Pilot d={data} />
      </div>
    </>
  );
}

function Kpis({ d }: { d: Data }) {
  const t = d.totals;
  return (
    <section aria-label="Özet" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Yayındaki eser" value={fmt(t.verified)} note={`${d.cities.length} il · ${t.draft} taslak · ${t.archived} arşivde`} />
      <Kpi label="Fotoğrafı olan eser" value={fmt(t.withPhoto)} share={pct(t.withPhoto, t.verified)} note={`yayındaki ${fmt(t.verified)} eserin`} />
      <Kpi label="Metni yayında olan eser" value={fmt(t.withText)} share={pct(t.withText, t.verified)} note={`${fmt(d.texts.pending)} taslak onay bekliyor`} />
      <Kpi label="Kesin konumlu eser" value={fmt(t.exact)} share={pct(t.exact, t.verified)} note="haritada yapı düzeyinde" />
    </section>
  );
}

/** Özet kartı: etiket, büyük sayı, oran çubuğu (varsa) ve tek satır not; gri alt şerit yok (kartlar düz). */
function Kpi({ label, value, note, share }: { label: string; value: string; note: string; share?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="font-semibold">{label}</CardDescription>
        <CardTitle className="num text-4xl font-extrabold tracking-tight">{value}</CardTitle>
        {share !== undefined ? (
          <CardAction>
            <Badge variant="success" className="num h-6 px-2.5 text-sm font-bold">
              %{share}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-2.5 text-sm text-muted-foreground">
        {share !== undefined ? <Progress value={share} className="h-2" aria-label={`${label}: yüzde ${share}`} /> : null}
        <span>{note}</span>
      </CardContent>
    </Card>
  );
}

const cityConfig = {
  inventory: { label: 'Kitapta', color: 'var(--chart-4)' },
  verified: { label: 'Yayında', color: 'var(--chart-1)' },
  withText: { label: 'Metinli', color: 'var(--chart-2)' },
  withPhoto: { label: 'Fotoğraflı', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function CityChart({ cities }: { cities: CityStats[] }) {
  const rows = cities.map((c) => ({ ...c, inventory: c.inventory ?? 0 }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>İllere göre kapsam</CardTitle>
        <CardDescription>Envanter kitabındaki eser sayısı, yayındaki kayıtlar ve bunların kaçında fotoğraf ve metin olduğu.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={cityConfig} className="aspect-auto h-72 w-full" aria-label="İllere göre eser kapsamı grafiği; sayılar aşağıdaki tabloda.">
          <BarChart data={rows} accessibilityLayer barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={36} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {(Object.keys(cityConfig) as (keyof typeof cityConfig)[]).map((k) => (
              <Bar key={k} dataKey={k} fill={`var(--color-${k})`} radius={4} />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Queue({ d }: { d: Data }) {
  const items: { to: string; title: string; count: number; note: string; icon: LucideIcon }[] = [];
  const nav = new Map(NAV.flatMap((g) => g.items).map((i) => [i.to, i]));
  const add = (to: string, count: number, note: string, title?: string) => {
    const n = nav.get(to.split('?')[0]!)!;
    items.push({ to, count, note, title: title ?? n.title, icon: n.icon });
  };
  add('/metinler', d.texts.pending, 'kitap sayfasıyla karşılaştırılıp yayınlanacak metin taslağı');
  add('/eslestirme', d.candidates.worksPending, `eserde konum kararı bekleniyor (${fmt(d.candidates.pending)} aday)`);
  add('/fotograflar', d.photos.unlinked + d.photos.draftLinked, `fotoğraf: ${d.photos.unlinked} esere bağlanmamış, ${d.photos.draftLinked} onay bekliyor`);
  add('/eserler?review=1', d.needsReview, 'eser içindekiler ayrıştırmasında şüpheli işaretlendi', 'İnceleme bekleyen eserler');
  add('/bildirimler', d.reports.pending, 'erişilebilirlik bildirimi onay bekliyor');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sırada bekleyenler</CardTitle>
        <CardDescription>Yayına girmek için admin kararı bekleyen işler. Hiçbiri kendiliğinden yayınlanmaz.</CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-2">
          {items.map((i) => (
            <Item key={i.to} variant="outline" size="sm" asChild>
              <Link to={i.to}>
                <ItemMedia variant="icon">
                  <i.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    <span className="num font-heading text-lg font-extrabold">{fmt(i.count)}</span> {i.title}
                  </ItemTitle>
                  <ItemDescription>{i.count === 0 ? 'Bekleyen yok.' : i.note}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight className="text-muted-foreground" aria-hidden />
                </ItemActions>
              </Link>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

function CityTable({ d }: { d: Data }) {
  const sum = (k: keyof Omit<CityStats, 'slug' | 'name' | 'inventory'>) => d.cities.reduce((s, c) => s + c[k], 0);
  const inventory = d.cities.reduce((s, c) => s + (c.inventory ?? 0), 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>İl tablosu</CardTitle>
        <CardDescription>
          Eser listesi envanter kitaplarının içindekiler sayfalarından çıkarıldı (<code>data/inventory_toc.py</code>). “Kitapta” sütunu bilgi
          notundaki sayıdır; fark, içindekilerde tek satırda verilen yapı grupları ya da ayrıştırmada düşen satırlar olabilir.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>İl</TableHead>
              <TableHead className="text-right">Kitapta</TableHead>
              <TableHead className="text-right">Yayında</TableHead>
              <TableHead className="text-right">Taslak</TableHead>
              <TableHead className="text-right">Kesin konum</TableHead>
              <TableHead className="text-right">Yaklaşık</TableHead>
              <TableHead className="text-right">Konumsuz</TableHead>
              <TableHead className="text-right">Fotoğraflı</TableHead>
              <TableHead className="text-right">Metinli</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.cities.map((c) => (
              <TableRow key={c.slug}>
                <TableCell className="font-semibold">
                  <Link className="underline-offset-4 hover:underline" to={`/eserler?city=${c.slug}`}>
                    {c.name}
                  </Link>
                </TableCell>
                <Num v={c.inventory} />
                <Num v={c.verified} of={c.inventory} />
                <Num v={c.draft} />
                <Num v={c.exact} of={c.verified} />
                <Num v={c.approximate} of={c.verified} />
                <Num v={c.unknown} of={c.verified} />
                <Num v={c.withPhoto} of={c.verified} />
                <Num v={c.withText} of={c.verified} />
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Toplam</TableCell>
              <Num v={inventory} />
              <Num v={sum('verified')} of={inventory} />
              <Num v={sum('draft')} />
              <Num v={sum('exact')} of={sum('verified')} />
              <Num v={sum('approximate')} of={sum('verified')} />
              <Num v={sum('unknown')} of={sum('verified')} />
              <Num v={sum('withPhoto')} of={sum('verified')} />
              <Num v={sum('withText')} of={sum('verified')} />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function Num({ v, of }: { v: number | null; of?: number | null }) {
  return (
    <TableCell className="num text-right">
      {v === null ? '–' : fmt(v)}
      {v !== null && of ? <span className="ml-1.5 text-xs text-muted-foreground">%{pct(v, of)}</span> : null}
    </TableCell>
  );
}

const photoConfig = {
  published: { label: 'Yayında', color: 'var(--chart-1)' },
  draftLinked: { label: 'Esere bağlı, onay bekliyor', color: 'var(--chart-2)' },
  unlinked: { label: 'Esere bağlanmamış', color: 'var(--chart-3)' },
} satisfies ChartConfig;

function PhotoChart({ d }: { d: Data }) {
  const rows = (Object.keys(photoConfig) as (keyof typeof photoConfig)[]).map((k) => ({ key: k, value: d.photos[k] }));
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fotoğraflar</CardTitle>
        <CardDescription>Hepsi Vakıf Katılım envanter fotoğraf arşivinden (yalnız Bursa örneklemi paylaşıldı). Kitaptaki kareyle eşleşen fotoğraf esere kendiliğinden bağlandı.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={photoConfig} className="mx-auto aspect-square h-60" aria-label={`Fotoğraf durumu: ${rows.map((r) => `${photoConfig[r.key].label} ${r.value}`).join(', ')}`}>
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
            <Pie data={rows} dataKey="value" nameKey="key" innerRadius={62} strokeWidth={4}>
              {rows.map((r) => (
                <Cell key={r.key} fill={`var(--color-${r.key})`} />
              ))}
              <Label
                content={({ viewBox }) =>
                  viewBox && 'cx' in viewBox ? (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground font-heading text-3xl font-extrabold">
                        {total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 22} className="fill-muted-foreground text-xs">
                        fotoğraf
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} className="flex-wrap gap-2" />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link to="/fotograflar">
            Fotoğraf kutusunu aç
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function Pilot({ d }: { d: Data }) {
  const works = [...d.pilot.works].sort((a, b) => Number(a.photo) - Number(b.photo) || a.name.localeCompare(b.name, 'tr'));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pilot alan ve turlar</CardTitle>
        <CardDescription>
          {d.pilot.name}: turlar Turlar sayfasından düzenlenir; demoda en çok görülecek sayfalar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tur</TableHead>
              <TableHead className="text-right">Durak</TableHead>
              <TableHead className="text-right">Fotoğraflı</TableHead>
              <TableHead className="text-right">Metinli</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.pilot.tours.map((t) => (
              <TableRow key={t.slug}>
                <TableCell className="font-semibold">
                  {t.title}
                  {t.status !== 'verified' ? (
                    <Badge variant="outline" className="ml-2">
                      Taslak
                    </Badge>
                  ) : null}
                </TableCell>
                <Num v={t.stops} />
                <Num v={t.photo} of={t.stops} />
                <Num v={t.text} of={t.stops} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Eser</TableHead>
              <TableHead className="text-center">Fotoğraf</TableHead>
              <TableHead className="text-center">Metin</TableHead>
              <TableHead className="text-center">Kesin konum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {works.map((w) => (
              <TableRow key={w.slug}>
                <TableCell>
                  <Link className="font-semibold underline-offset-4 hover:underline" to={`/eserler/${w.slug}`}>
                    {w.name}
                  </Link>
                </TableCell>
                <Mark ok={w.photo} label="Fotoğraf" />
                <Mark ok={w.text} label="Metin" />
                <Mark ok={w.exact} label="Kesin konum" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Var / yok: simge + ekran okuyucu metni (renk tek başına anlam taşımaz). */
function Mark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <TableCell className="text-center">
      {ok ? <Check className="inline text-success-foreground" aria-hidden /> : <Minus className="inline text-muted-foreground" aria-hidden />}
      <span className="sr-only">
        {label}: {ok ? 'var' : 'yok'}
      </span>
    </TableCell>
  );
}

function DashboardSkeleton() {
  const block = (h: string): ReactNode => <Skeleton className={`${h} w-full rounded-xl`} />;
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Pano yükleniyor">
      <PageHeader />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {block('h-36')}
        {block('h-36')}
        {block('h-36')}
        {block('h-36')}
      </div>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        {block('h-96')}
        {block('h-96')}
      </div>
      {block('h-64')}
    </div>
  );
}
