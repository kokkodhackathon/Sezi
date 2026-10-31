import { ArrowRight, ChevronRight, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDashboard, type CityStats, type Dashboard as DashboardData } from '@/lib/dashboard';
import { useUserStats, type UserStats } from '@/lib/users';

const fmt = (n: number) => n.toLocaleString('tr-TR');
const pct = (value: number, of: number) => (of ? Math.round((value / of) * 100) : 0);
const coverageConfig = {
  inventory: { label: 'Kitapta', color: 'var(--chart-2)' },
  published: { label: 'Yayında', color: 'var(--chart-1)' },
  withPhoto: { label: 'Fotoğraflı', color: 'var(--chart-3)' },
  withText: { label: 'Metinli', color: 'var(--chart-4)' },
} satisfies ChartConfig;
const activityConfig = {
  visits: { label: 'Ziyaret', color: 'var(--chart-1)' },
  signups: { label: 'Kayıt', color: 'var(--chart-3)' },
} satisfies ChartConfig;
const photosConfig = {
  published: { label: 'Yayında', color: 'var(--chart-1)' },
  pending: { label: 'Onay bekliyor', color: 'var(--chart-3)' },
  unlinked: { label: 'Esere bağlı değil', color: 'var(--chart-5)' },
} satisfies ChartConfig;
const photoColors = ['var(--chart-1)', 'var(--chart-3)', 'var(--chart-5)'];

export function Dashboard() {
  const content = useDashboard();
  const people = useUserStats();
  const refresh = () => void Promise.all([content.refetch(), people.refetch()]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Pano"
        actions={
          <Button variant="outline" size="icon-sm" aria-label="Panoyu yenile" onClick={refresh}>
            <RefreshCw aria-hidden />
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {content.isPending ? (
          Array.from({ length: 4 }, (_, index) => <KpiSkeleton key={index} />)
        ) : content.error || !content.data ? (
          <div className="sm:col-span-2 xl:col-span-4">
            <BlockError message="İçerik kapsamı yüklenemedi." retry={() => void content.refetch()} />
          </div>
        ) : (
          <Kpis data={content.data} />
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {content.isPending ? <ChartSkeleton title="İllere göre kapsam" /> : content.data ? (
            <CityCoverage data={content.data} />
          ) : null}
        </div>
        <div className="min-w-0">
          {content.isPending ? <ListSkeleton title="Bekleyen işler" /> : content.data ? (
            <Pending data={content.data} />
          ) : null}
        </div>
      </div>
      {content.data ? <CityTable data={content.data} /> : null}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {people.isPending ? <ChartSkeleton title="Son 30 gün" /> : people.error || !people.data ? (
            <BlockError message="Son 30 gün yüklenemedi." retry={() => void people.refetch()} />
          ) : <Activity stats={people.data} />}
        </div>
        <div className="min-w-0">
          {people.isPending ? <UsersSkeleton /> : people.error || !people.data ? (
            <BlockError message="Kullanıcılar yüklenemedi." retry={() => void people.refetch()} />
          ) : <Users stats={people.data} />}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0">
          {content.isPending ? <ChartSkeleton title="Fotoğraflar" /> : content.data ? (
            <Photos data={content.data} />
          ) : null}
        </div>
        <div className="min-w-0 xl:col-span-2">
          {content.isPending ? <TourSkeleton /> : content.data ? <Tours data={content.data} /> : null}
        </div>
      </div>
    </div>
  );
}

function Kpis({ data }: { data: DashboardData }) {
  const total = data.totals.verified;
  const items = [
    {
      label: 'Yayındaki eser',
      value: total,
      note: `${data.cities.length} il · ${fmt(data.totals.draft)} taslak · ${fmt(data.totals.archived)} arşivde`,
    },
    { label: 'Fotoğraflı', value: data.totals.withPhoto, ratio: total, note: `yayındaki ${fmt(total)} eserin` },
    { label: 'Metinli', value: data.totals.withText, ratio: total, note: `${fmt(data.texts.pending)} taslak onay bekliyor` },
    { label: 'Kesin konumlu', value: data.totals.exact, ratio: total, note: 'haritada yapı düzeyinde' },
  ];
  return (
    <>
      {items.map((item) => (
        <Card className="h-full" key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{fmt(item.value)}</span>
              {item.ratio !== undefined ? (
                <span className="text-sm text-muted-foreground">%{pct(item.value, item.ratio)}</span>
              ) : null}
            </div>
            {item.ratio !== undefined ? (
              <Progress value={pct(item.value, item.ratio)} aria-label={`${item.label}: %${pct(item.value, item.ratio)}`} />
            ) : null}
            <p className="text-xs text-muted-foreground">{item.note}</p>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

function CityCoverage({ data }: { data: DashboardData }) {
  const cities = data.cities.map((city) => ({
    city: city.name,
    inventory: city.inventory ?? 0,
    published: city.verified,
    withPhoto: city.withPhoto,
    withText: city.withText,
  }));
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>İllere göre kapsam</CardTitle>
        <CardDescription>
          Envanter kitabındaki eser sayısı, yayındaki kayıtlar ve bunların kaçında fotoğraf ve metin olduğu.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={coverageConfig}
          className="h-[200px] w-full sm:h-[250px]"
          aria-label="İllere göre kitaptaki, yayındaki, fotoğraflı ve metinli eser sayıları"
        >
          <BarChart data={cities} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />
            <XAxis dataKey="city" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={40} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="inventory" fill="var(--color-inventory)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="published" fill="var(--color-published)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="withPhoto" fill="var(--color-withPhoto)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="withText" fill="var(--color-withText)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Pending({ data }: { data: DashboardData }) {
  const items = [
    { label: 'Metin taslakları', to: '/metinler', count: data.texts.pending, note: 'Kitap sayfasıyla karşılaştırılıp yayınlanacak' },
    {
      label: 'Konum eşleştirme',
      to: '/eslestirme',
      count: data.candidates.worksPending,
      note: `Eserde konum kararı bekleniyor · ${fmt(data.candidates.pending)} aday`,
    },
    {
      // Menü rozetiyle aynı sayı: esere bağlanmamış + onay bekleyen.
      label: 'Fotoğraf kutusu',
      to: '/fotograflar',
      count: data.photos.unlinked + data.photos.draftLinked,
      note: `${fmt(data.photos.unlinked)} esere bağlanmamış · ${fmt(data.photos.draftLinked)} onay bekliyor`,
    },
    {
      label: 'İnceleme bekleyen eserler',
      to: '/eserler?review=1',
      count: data.needsReview,
      note: 'İçindekiler ayrıştırmasında şüpheli işaretlendi',
    },
    { label: 'Ziyaretçi fotoğrafları', to: '/topluluk-fotograflari', count: data.community.pending, note: 'Yayın onayı ya da arşiv önerisi' },
    { label: 'Bildirimler', to: '/bildirimler', count: data.reports.pending, note: 'Erişilebilirlik bildirimi onay bekliyor' },
  ];
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Bekleyen işler</CardTitle>
        <CardDescription>Hiçbiri kendiliğinden yayınlanmaz; her biri admin kararı bekler.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex min-h-12 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="min-w-0">
              <span className="block">{item.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.count === 0 ? 'Bekleyen yok' : item.note}</span>
            </span>
            <span className={item.count === 0 ? 'tabular-nums text-muted-foreground' : 'font-semibold tabular-nums'}>{fmt(item.count)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/** İl tablosu: kapalı başlar; yaklaşık ve konumsuz eserler, il başına taslak sayısı yalnız burada görünür. */
function CityTable({ data }: { data: DashboardData }) {
  const sum = (key: 'verified' | 'draft' | 'exact' | 'approximate' | 'unknown' | 'withPhoto' | 'withText') =>
    data.cities.reduce((total, city) => total + city[key], 0);
  const inventory = data.cities.reduce((total, city) => total + (city.inventory ?? 0), 0);
  const columns: { label: string; value: (city: CityStats) => number | null; of?: (city: CityStats) => number | null }[] = [
    { label: 'Kitapta', value: (city) => city.inventory },
    { label: 'Yayında', value: (city) => city.verified, of: (city) => city.inventory },
    { label: 'Taslak', value: (city) => city.draft },
    { label: 'Kesin konum', value: (city) => city.exact, of: (city) => city.verified },
    { label: 'Yaklaşık', value: (city) => city.approximate, of: (city) => city.verified },
    { label: 'Konumsuz', value: (city) => city.unknown, of: (city) => city.verified },
    { label: 'Fotoğraflı', value: (city) => city.withPhoto, of: (city) => city.verified },
    { label: 'Metinli', value: (city) => city.withText, of: (city) => city.verified },
  ];
  return (
    <Card>
      <details className="group">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 font-heading font-semibold focus-visible:outline-2 focus-visible:outline-ring">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
          İl tablosu
          <span className="text-sm font-normal text-muted-foreground">· {data.cities.length} il</span>
        </summary>
        <CardContent className="space-y-3 pt-2">
          <CardDescription>
            Eser listesi envanter kitaplarının içindekiler sayfalarından çıkarıldı. “Kitapta” sütunu bilgi notundaki sayıdır; fark,
            içindekilerde tek satırda verilen yapı grupları ya da ayrıştırmada düşen satırlar olabilir.
          </CardDescription>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>İl</TableHead>
                {columns.map((column) => (
                  <TableHead key={column.label} className="text-right">
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.cities.map((city) => (
                <TableRow key={city.slug}>
                  <TableCell className="font-semibold">
                    <Link className="underline-offset-4 hover:underline" to={`/eserler?city=${city.slug}`}>
                      {city.name}
                    </Link>
                  </TableCell>
                  {columns.map((column) => (
                    <Num key={column.label} value={column.value(city)} of={column.of?.(city)} />
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Toplam</TableCell>
                <Num value={inventory} />
                <Num value={sum('verified')} of={inventory} />
                <Num value={sum('draft')} />
                <Num value={sum('exact')} of={sum('verified')} />
                <Num value={sum('approximate')} of={sum('verified')} />
                <Num value={sum('unknown')} of={sum('verified')} />
                <Num value={sum('withPhoto')} of={sum('verified')} />
                <Num value={sum('withText')} of={sum('verified')} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </details>
    </Card>
  );
}

/** Sayı hücresi: eksik değer gri tire; oran varsa yanında küçük yüzde. */
function Num({ value, of }: { value: number | null; of?: number | null }) {
  return (
    <TableCell className="text-right tabular-nums">
      {value === null ? <span className="text-muted-foreground">–</span> : fmt(value)}
      {value !== null && of ? <span className="ml-1.5 text-xs text-muted-foreground">%{pct(value, of)}</span> : null}
    </TableCell>
  );
}

function Activity({ stats }: { stats: UserStats }) {
  const visits = new Map(stats.visits.by_day.map((day) => [day.date, day.count]));
  const signups = new Map(stats.signups_by_day.map((day) => [day.date, day.count]));
  const dates = [...new Set([...visits.keys(), ...signups.keys()])].sort();
  const rows = dates.map((date) => ({
    date,
    day: new Date(`${date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }).replace('.', ''),
    visits: visits.get(date) ?? 0,
    signups: signups.get(date) ?? 0,
  }));
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Son 30 gün</CardTitle></CardHeader>
      <CardContent>
        <ChartContainer config={activityConfig} className="h-[200px] w-full sm:h-[250px]" aria-label="Son 30 gündeki günlük ziyaret ve kayıt sayıları">
          <BarChart data={rows} margin={{ left: 0, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="visits" fill="var(--color-visits)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="signups" fill="var(--color-signups)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Users({ stats }: { stats: UserStats }) {
  const values = [
    ['Toplam', stats.users.total],
    ['Son 7 günde aktif', stats.users.active_7d],
    ['Son 30 günde yeni', stats.users.new_30d],
    ['Yönetici', stats.users.admins],
  ] as const;
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Kullanıcılar</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {values.map(([label, value]) => <div key={label}>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold tabular-nums">{fmt(value)}</div>
          </div>)}
        </div>
        <Link className="mt-5 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline" to="/kullanicilar">Tümünü gör</Link>
      </CardContent>
    </Card>
  );
}

function Photos({ data }: { data: DashboardData }) {
  const values = [
    { key: 'published', value: data.photos.published },
    { key: 'pending', value: data.photos.draftLinked },
    { key: 'unlinked', value: data.photos.unlinked },
  ] as const;
  const total = values.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Fotoğraflar</CardTitle>
        <CardDescription>
          Vakıf Katılım envanter fotoğraf arşivinden (yalnız Bursa örneklemi paylaşıldı). Kitaptaki kareyle eşleşen fotoğraf esere kendiliğinden
          bağlandı.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative w-full">
          <ChartContainer
            config={photosConfig}
            className="h-[200px] w-full sm:h-[250px]"
            aria-label={`Fotoğraflar: ${fmt(total)} toplam; ${fmt(values[0].value)} yayında; ${fmt(values[1].value)} bekliyor; ${fmt(values[2].value)} bağlantısız`}
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie data={values} dataKey="value" nameKey="key" innerRadius={56} outerRadius={82} strokeWidth={3} isAnimationActive={false}>
                {values.map((entry, index) => <Cell key={entry.key} fill={photoColors[index]} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{fmt(total)}</span>
            <span className="text-xs text-muted-foreground">Toplam</span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {values.map((item, index) => <span className="inline-flex items-center gap-1.5" key={item.key}>
            <span className="size-2 rounded-full" style={{ backgroundColor: photoColors[index] }} />{photosConfig[item.key]?.label}
          </span>)}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" asChild>
          <Link to="/fotograflar">
            Fotoğraf kutusunu aç
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function Tours({ data }: { data: DashboardData }) {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Turlar</CardTitle></CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tur</TableHead><TableHead className="text-right">Durak</TableHead>
              <TableHead className="text-right">Fotoğraflı</TableHead><TableHead className="text-right">Metinli</TableHead>
            </TableRow></TableHeader>
            <TableBody>{data.pilot.tours.map((tour) => <TableRow key={tour.slug}>
              <TableCell className="max-w-[180px] truncate">{tour.title}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(tour.stops)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(tour.photo)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmt(tour.text)}</TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function BlockError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span><Button variant="outline" size="sm" onClick={retry}>Yeniden dene</Button>
      </AlertDescription>
    </Alert>
  );
}

function KpiSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2"><Skeleton className="h-4 w-28" /></CardHeader>
      <CardContent><Skeleton className="h-9 w-20" /></CardContent>
    </Card>
  );
}

function ChartSkeleton({ title }: { title: string }) {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent><Skeleton className="h-[200px] w-full sm:h-[250px]" /></CardContent>
    </Card>
  );
}

function ListSkeleton({ title }: { title: string }) {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-5 w-full" key={index} />)}
      </CardContent>
    </Card>
  );
}

function UsersSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Kullanıcılar</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-5">
        {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-12 w-full" key={index} />)}
      </CardContent>
    </Card>
  );
}

function TourSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader><CardTitle>Turlar</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => <Skeleton className="h-8 w-full" key={index} />)}
      </CardContent>
    </Card>
  );
}
