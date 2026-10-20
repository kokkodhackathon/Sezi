import { formatDistance, PROFILE_KEYS, profileFor, walkingSpeed, type LngLat, type ProfileKey } from '@sezi/shared';
import { cn } from 'cn';
import { Ban, CircleAlert, CornerUpRight, Info, MapPin, Pause, Play, ScrollText, Square, Volume2 } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';

import { PageHeader } from '@/components/page-header';
import { RouteTestMap } from '@/components/RouteTestMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { pilotPlanner } from '@/lib/pilot';
import {
  PROFILE_LABEL,
  PROFILE_LINE,
  PROFILE_WHY,
  useRouteTest,
  type LogKind,
  type ProfileRoute,
  type RouteTestState,
} from '@/lib/route-test';
import { AUDIO_BASE } from '@/lib/supabase';
const SPEEDS = [1, 3, 8, 20];

const NOTE: Record<NonNullable<RouteTestState['note']>, string> = {
  need_start: 'Başlangıç seçin: listeden bir başlangıç noktası ya da haritadan bir yer.',
  outside_pilot: 'Seçilen yer pilot alanın (Ulu Cami ve Hanlar Bölgesi) dışında; rota yalnızca burada çizilir.',
  no_route: 'Bu profil için bu esere yol bulunamadı (kapalı yol, merdiven ya da bağlantısız grafik).',
  no_points: 'Yakında yayında anlatım noktası yok; gezinti oluşturulamadı.',
};

const LOG_LABEL: Record<LogKind, string> = {
  step: 'Talimat',
  point: 'Nokta',
  reroute: 'Yeni rota',
  blocked: 'Senaryo',
  detour: 'Senaryo',
  arrive: 'Varış',
  info: 'Bilgi',
};

const minutes = (m: number, mps: number) => Math.max(1, Math.round(m / mps / 60));
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/**
 * Rota testi: uygulamadaki planlayıcı ve sanal yürüyüş, telefona gerek kalmadan.
 * Noktalar sayfasında yapılan değişiklik (taslak dahil) burada hemen denenebilir.
 */
export function RouteTest() {
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const { test, state, points, overrides, isLoading, error } = useRouteTest(includeDrafts);
  const [picking, setPicking] = useState(false);

  const starts = pilotPlanner.startPoints();
  const works = useMemo(() => [...pilotPlanner.pilotWorks].sort((a, b) => (a.name?.tr ?? '').localeCompare(b.name?.tr ?? '', 'tr')), []);
  const plan = state.plan;
  const order = useMemo(() => new Map((plan?.via.pointIds ?? []).map((id, i) => [id, i + 1])), [plan]);
  const fired = useMemo(() => new Set(state.fired), [state.fired]);
  const blockedLines = useMemo(
    () => [...state.blocked, ...overrides.filter((o) => o.type === 'construction' || o.type === 'ramp_blocked').map((o) => o.segment_key)].flatMap((id) => {
      const c = pilotPlanner.segmentCoords(id);
      return c ? [c] : [];
    }),
    [state.blocked, overrides],
  );
  const profileMps = walkingSpeed(profileFor(state.profile, state.lang));
  const stats = plan ? pilotPlanner.routeStats(plan) : null;
  const total = plan ? plan.geometry.nodeAtM.at(-1)! : 0;
  const openPoint = state.openPoint ? points.find((p) => p.id === state.openPoint) : undefined;
  const selectedStart = state.start?.kind === 'point' ? state.start.id : null;
  const pickedStart = state.start?.kind === 'pick' ? state.start.location : null;
  const active = state.phase === 'active';
  const planning = state.phase === 'plan';
  const current = plan && state.stepIndex >= 0 ? plan.steps[state.stepIndex] : undefined;

  // Profil karşılaştırması yalnızca plan aşamasında; plan, başlangıç, hedef, dil ya da nokta değişince yeniden hesaplanır.
  const [comparing, setComparing] = useState(false);
  const rows = useMemo(
    () => (comparing && planning ? test.compareProfiles() : null),
    // state.plan: replan her değişiklikte yeni plan üretir (başlangıç, hedef, dil, noktalar, bildirimler).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparing, planning, state.plan, state.start, state.dest, state.lang, test],
  );
  const compareLines = useMemo(
    () => (rows ? rows.flatMap((r) => (r.plan ? [{ key: r.key, line: r.plan.geometry.line, selected: r.key === state.profile }] : [])) : null),
    [rows, state.profile],
  );

  const pick = (p: LngLat) => {
    if (!planning) return;
    setPicking(false);
    test.setStart({ kind: 'pick', location: p });
  };

  const startSelectValue = selectedStart ?? (pickedStart ? '__picked__' : '__none__');

  return (
    <>
      <PageHeader
        hint="Uygulamadaki rota planlayıcı ve sanal yürüyüş: aynı grafik, aynı noktalar, aynı talimatlar. Telefona gerek kalmadan rota, uğrama noktaları ve senaryolar denenir."
        actions={
          <Field orientation="horizontal" className="w-auto rounded-lg border bg-card px-3 py-2">
            <Switch id="rt-include-drafts" checked={includeDrafts} onCheckedChange={setIncludeDrafts} disabled={!planning} />
            <FieldContent>
              <FieldLabel htmlFor="rt-include-drafts">Taslak noktaları da kullan</FieldLabel>
              <FieldDescription>Uygulama yalnızca yayındakileri görür.</FieldDescription>
            </FieldContent>
          </Field>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Noktalar alınamadı</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? <Skeleton className="h-12 w-full" /> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(380px,2fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Rota haritası</CardTitle>
              <CardDescription>
                {rows
                  ? 'Her profilin rotası kendi çizgisiyle; seçili profil öne çıkar. Çizgi örnekleri aşağıdaki tabloda.'
                  : 'Turkuaz çizgi kalan rota, gri kısmı yürünen yol; kesikli kırmızı kapalı yol, kesikli sarı yanlış dönüş. Numaralı daireler rotanın uğradığı noktalar, gri olanlar açılmış noktalar.'}
              </CardDescription>
              {planning ? (
                <CardAction>
                  <Tabs value={comparing ? 'compare' : 'single'} onValueChange={(v) => setComparing(v === 'compare')}>
                    <TabsList>
                      <TabsTrigger value="single">Tek profil</TabsTrigger>
                      <TabsTrigger value="compare">Profilleri karşılaştır</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              <RouteTestMap
                center={pilotPlanner.center}
                routeLine={plan?.geometry.line ?? null}
                walkedM={state.distance}
                detourLine={state.detourLine}
                blockedLines={blockedLines}
                starts={starts}
                works={works}
                points={points}
                order={order}
                fired={fired}
                selectedStart={selectedStart}
                pickedStart={pickedStart}
                dest={state.dest}
                position={state.position}
                picking={picking}
                onPick={pick}
                onStart={(id) => planning && test.setStart({ kind: 'point', id })}
                onDest={(slug) => planning && test.setDest(slug)}
                compare={compareLines}
              />
            </CardContent>
          </Card>

          {plan && stats ? (
            <section aria-label="Rota özeti" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Uzunluk ve süre</CardDescription>
                  <CardTitle className="num text-xl font-extrabold">
                    {formatDistance(stats.lengthM, 'tr')} · ~{minutes(stats.lengthM, profileMps)} dk
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Basamak ve zemin</CardDescription>
                  <CardTitle className="num text-xl font-extrabold">
                    {stats.stairs === 0 ? 'Basamaksız' : `${stats.stairs} basamaklı geçiş`}
                  </CardTitle>
                </CardHeader>
                {stats.busyM > 0 || stats.cobbleM > 0 ? (
                  <CardContent className="flex flex-wrap gap-1.5 pt-0">
                    {stats.busyM > 0 ? (
                      <Badge variant="outline" className="num">
                        Ana cadde {stats.busyM} m
                      </Badge>
                    ) : null}
                    {stats.cobbleM > 0 ? (
                      <Badge variant="outline" className="num">
                        Arnavut kaldırımı {stats.cobbleM} m
                      </Badge>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Adımlar</CardDescription>
                  <CardTitle className="num text-xl font-extrabold">{plan.steps.length} talimat</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardDescription>Uğrama ve varış</CardDescription>
                  <CardTitle className="num text-xl font-extrabold">{plan.via.pointIds.length} nokta</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5 pt-0">
                  {plan.via.pointIds.length ? (
                    <Badge variant="success" className="num">
                      {plan.via.pointIds.length} noktaya uğrar{plan.via.extraM > 0 ? ` · +${plan.via.extraM} m` : ''}
                    </Badge>
                  ) : null}
                  {plan.arrival ? (
                    <Badge variant="success">Varış bilgisi var</Badge>
                  ) : plan.kind === 'work' ? (
                    <Badge variant="warning">Varış bilgisi yok</Badge>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          ) : null}

          {/* Karşılaştırma açıkken tablo haritanın hemen altında; tek profilin talimatları gizlenir. */}
          {rows ? <CompareTable rows={rows} selected={state.profile} onSelect={(k) => test.setProfile(k)} /> : null}
          {plan && !rows ? <Steps plan={plan} stepIndex={state.stepIndex} /> : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card aria-labelledby="rt-plan">
            <CardHeader>
              <CardTitle id="rt-plan">Rota</CardTitle>
              <CardDescription>Profil, dil, başlangıç ve hedef seçimi.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={!planning}>
                  <FieldLabel>Profil</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={state.profile}
                    onValueChange={(v) => {
                      if (v) test.setProfile(v as ProfileKey);
                    }}
                    disabled={!planning}
                    aria-label="Profil"
                    className="flex-wrap justify-start gap-y-3"
                  >
                    {PROFILE_KEYS.map((k) => (
                      <ToggleGroupItem key={k} value={k}>
                        {PROFILE_LABEL[k]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>{PROFILE_WHY[state.profile]}</FieldDescription>
                </Field>

                <Field data-disabled={!planning}>
                  <FieldLabel>Talimat dili</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={state.lang}
                    onValueChange={(v) => {
                      if (v === 'tr' || v === 'en') test.setLang(v);
                    }}
                    disabled={!planning}
                    aria-label="Talimat dili"
                  >
                    <ToggleGroupItem value="tr">Türkçe</ToggleGroupItem>
                    <ToggleGroupItem value="en">English</ToggleGroupItem>
                  </ToggleGroup>
                </Field>

                <Field data-disabled={!planning}>
                  <FieldLabel>Nereden</FieldLabel>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={startSelectValue}
                      onValueChange={(v) => {
                        if (v && v !== '__none__' && v !== '__picked__') {
                          setPicking(false);
                          test.setStart({ kind: 'point', id: v });
                        }
                      }}
                      disabled={!planning}
                    >
                      <SelectTrigger aria-label="Başlangıç noktası" className="min-w-48 flex-1">
                        <SelectValue placeholder="Başlangıç seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="__none__" disabled>
                            Başlangıç noktası seçin…
                          </SelectItem>
                          {pickedStart ? (
                            <SelectItem value="__picked__">
                              Haritadan seçilen konum ({pickedStart[1]}, {pickedStart[0]})
                            </SelectItem>
                          ) : null}
                          {starts.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name.tr}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant={picking || pickedStart ? 'default' : 'outline'}
                      size="default"
                      aria-pressed={picking}
                      disabled={!planning}
                      onClick={() => setPicking(!picking)}
                    >
                      <MapPin data-icon="inline-start" />
                      {picking ? 'Haritaya tıklayın…' : pickedStart ? 'Haritadan seçildi' : 'Haritadan seç'}
                    </Button>
                  </div>
                  {starts.length > 0 ? (
                    <div className="flex flex-wrap gap-x-2 gap-y-4 pt-1" role="group" aria-label="Hızlı başlangıç noktaları">
                      {starts.map((s) => (
                        <Button
                          key={s.id}
                          type="button"
                          variant={selectedStart === s.id ? 'default' : 'outline'}
                          size="sm"
                          aria-pressed={selectedStart === s.id}
                          disabled={!planning}
                          onClick={() => {
                            setPicking(false);
                            test.setStart({ kind: 'point', id: s.id });
                          }}
                        >
                          {s.name.tr}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <FieldDescription>Yayında başlangıç noktası yok; haritadan seçin ya da Noktalar sayfasında ekleyin.</FieldDescription>
                  )}
                </Field>

                <Field data-disabled={!planning}>
                  <FieldLabel>Nereye</FieldLabel>
                  <Select
                    value={state.dest ?? '__stroll__'}
                    onValueChange={(v) => test.setDest(v === '__stroll__' ? null : v)}
                    disabled={!planning}
                  >
                    <SelectTrigger aria-label="Nereye" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="__stroll__">Gezinti (hedefsiz, yakındaki anlatım noktaları)</SelectItem>
                        {works.flatMap((w) =>
                          w.workSlug ? (
                            <SelectItem key={w.workSlug} value={w.workSlug}>
                              {w.name?.tr}
                            </SelectItem>
                          ) : (
                            []
                          ),
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                {state.note ? (
                  <Alert>
                    <Info />
                    <AlertDescription>{NOTE[state.note]}</AlertDescription>
                  </Alert>
                ) : null}

                <Field orientation="horizontal" data-disabled={!planning}>
                  <Switch id="rt-compare" checked={comparing} onCheckedChange={setComparing} disabled={!planning} />
                  <FieldContent>
                    <FieldLabel htmlFor="rt-compare">Profilleri karşılaştır</FieldLabel>
                    <FieldDescription>Aynı başlangıç ve hedef için dört profilin rotası haritada ve tabloda.</FieldDescription>
                  </FieldContent>
                </Field>

                {plan && plan.via.pointIds.length > 0 ? (
                  <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
                    <span className="text-xs font-semibold text-muted-foreground">Uğranacak anlatım noktaları</span>
                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
                      {plan.via.pointIds.map((id, i) => {
                        const p = points.find((x) => x.id === id);
                        const isFired = fired.has(id);
                        return (
                          <li key={id} className={cn(isFired && 'text-muted-foreground line-through')}>
                            <span className="font-medium">{p?.title.tr ?? id}</span>{' '}
                            <span className="num text-muted-foreground">· {Math.round(plan.via.atM[i]!)} m</span>
                            {p?.audio.tr || p?.audio.en ? <span className="text-muted-foreground"> · sesli</span> : null}
                            {isFired ? (
                              <Badge variant="secondary" className="ml-1.5">
                                açıldı
                              </Badge>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card aria-labelledby="rt-sim">
            <CardHeader>
              <CardTitle id="rt-sim">Simülasyon</CardTitle>
              <CardDescription>Sanal yürüyüşü başlatın, hızı ve yol senaryolarını deneyin.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="flex flex-wrap items-center gap-2">
                  {planning ? (
                    <Button disabled={!plan} onClick={() => test.begin()}>
                      <Play data-icon="inline-start" />
                      {state.dest ? 'Yürüyüşü başlat' : 'Gezintiye başla'}
                    </Button>
                  ) : (
                    <>
                      {active ? (
                        <Button variant="outline" onClick={() => (state.running ? test.pause() : test.resume())}>
                          {state.running ? <Pause data-icon="inline-start" /> : <Play data-icon="inline-start" />}
                          {state.running ? 'Duraklat' : 'Devam et'}
                        </Button>
                      ) : null}
                      <Button variant="destructive" onClick={() => test.stop()}>
                        <Square data-icon="inline-start" />
                        {active ? 'Yürüyüşü bitir' : 'Plana dön'}
                      </Button>
                    </>
                  )}
                </div>

                <Field>
                  <FieldLabel>Hız</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    value={String(state.speed)}
                    onValueChange={(v) => {
                      if (v) test.setSpeed(Number(v));
                    }}
                    aria-label="Simülasyon hızı"
                  >
                    {SPEEDS.map((v) => (
                      <ToggleGroupItem key={v} value={String(v)} className="num">
                        {v}×
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </Field>

                <Field>
                  <FieldLabel>Senaryolar</FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={!active} onClick={() => test.blockAhead()}>
                      <Ban data-icon="inline-start" />
                      Önümüzdeki yol kapandı
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!active || state.detouring} onClick={() => test.wrongTurn()}>
                      <CornerUpRight data-icon="inline-start" />
                      Yanlış dönüş
                    </Button>
                  </div>
                </Field>

                <Field orientation="horizontal">
                  <Switch id="rt-voice" checked={state.voice} onCheckedChange={(checked) => test.setVoice(checked)} />
                  <FieldContent>
                    <FieldLabel htmlFor="rt-voice">
                      <Volume2 className="text-muted-foreground" aria-hidden />
                      Sesli oku
                    </FieldLabel>
                    <FieldDescription>
                      Talimatlar tarayıcı sesiyle, noktalar kayıtla (yoksa metinden). Duymayan profilde ses yok.
                    </FieldDescription>
                  </FieldContent>
                </Field>

                {!planning ? (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3" aria-live="polite">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="num">
                        {Math.round(state.distance)} / {Math.round(total)} m
                      </Badge>
                      <Badge variant="secondary" className="num">
                        {clock(state.elapsedS)}
                      </Badge>
                      {state.reroutes ? (
                        <Badge variant="warning" className="num">
                          {state.reroutes} yeni rota
                        </Badge>
                      ) : null}
                      {state.blocked.length ? (
                        <Badge variant="warning" className="num">
                          {state.blocked.length} kapalı yol
                        </Badge>
                      ) : null}
                      {state.phase === 'arrived' ? <Badge variant="success">Vardı</Badge> : null}
                    </div>
                    <Progress
                      value={total > 0 ? Math.min(100, Math.round((state.distance / total) * 100)) : 0}
                      aria-label="Yürüyüş ilerlemesi"
                    />
                    {current ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="num text-xs font-semibold text-muted-foreground">
                          Şu anki talimat ({state.stepIndex + 1}/{plan!.steps.length})
                        </span>
                        <p className="text-base font-semibold">{current.text}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </FieldGroup>
            </CardContent>
          </Card>

          {openPoint ? (
            <Card aria-labelledby="rt-point" className="border-l-4 border-l-primary">
              <CardHeader>
                <CardTitle id="rt-point">{openPoint.title[state.lang] ?? openPoint.title.tr}</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={() => test.closePoint()}>
                    Kapat
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {openPoint.body ? (
                  <p>{openPoint.body[state.lang] ?? openPoint.body.tr}</p>
                ) : (
                  <p className="text-muted-foreground">Metin yok.</p>
                )}
                {openPoint.audio.tr || openPoint.audio.en ? (
                  <audio
                    controls
                    preload="none"
                    className="w-full"
                    src={AUDIO_BASE + (state.lang === 'en' ? (openPoint.audio.en ?? openPoint.audio.tr) : (openPoint.audio.tr ?? openPoint.audio.en))}
                    aria-label="Nokta ses kaydı"
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">Ses kaydı yok; uygulama metni seslendirir.</span>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card aria-labelledby="rt-log">
            <CardHeader>
              <CardTitle id="rt-log">Kayıt</CardTitle>
              <CardDescription>Zaman damgalı yürüyüş ve senaryo günlüğü.</CardDescription>
              {state.log.length > 0 ? (
                <CardAction>
                  <Badge variant="secondary" className="num">
                    {state.log.length}
                  </Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {state.log.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ScrollText />
                    </EmptyMedia>
                    <EmptyTitle>Henüz kayıt yok</EmptyTitle>
                    <EmptyDescription>Yürüyüş başlayınca talimatlar, açılan noktalar ve yeni rotalar burada sıralanır.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ScrollArea className="h-72">
                  <ol className="flex flex-col divide-y pr-3" aria-live="polite">
                    {state.log.map((e) => (
                      <li key={e.id} className="flex items-baseline gap-2 py-2 text-sm">
                        <span className="num shrink-0 text-xs text-muted-foreground">{clock(e.t)}</span>
                        <Badge
                          variant={
                            e.kind === 'blocked' || e.kind === 'detour' || e.kind === 'reroute'
                              ? 'warning'
                              : e.kind === 'arrive' || e.kind === 'point'
                                ? 'success'
                                : 'secondary'
                          }
                        >
                          {LOG_LABEL[e.kind]}
                        </Badge>
                        <span>{e.text}</span>
                      </li>
                    ))}
                  </ol>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** Rotanın tüm talimatları: yürürken o anki talimat vurgulanır. */
function Steps({ plan, stepIndex }: { plan: NonNullable<RouteTestState['plan']>; stepIndex: number }) {
  return (
    <Card aria-labelledby="rt-steps">
      <CardHeader>
        <CardTitle id="rt-steps">Talimatlar</CardTitle>
        <CardDescription>Rota boyunca adım adım yönlendirme talimatları.</CardDescription>
        <CardAction>
          <Badge variant="secondary" className="num">
            {plan.steps.length} adım
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="w-12">
                #
              </TableHead>
              <TableHead scope="col" className="w-24">
                Yer
              </TableHead>
              <TableHead scope="col">Talimat</TableHead>
              <TableHead scope="col" className="w-32">
                Tür
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plan.steps.map((s, i) => (
              <TableRow
                key={`${s.nodeId}-${i}`}
                aria-current={i === stepIndex ? 'step' : undefined}
                data-state={i === stepIndex ? 'selected' : undefined}
                className={cn(i === stepIndex && 'bg-primary/20 font-medium', i < stepIndex && 'text-muted-foreground')}
              >
                <TableCell className="num">{i + 1}</TableCell>
                <TableCell className="num">{Math.round(s.atM)} m</TableCell>
                <TableCell>{s.text}</TableCell>
                <TableCell className="text-muted-foreground">{s.kind ?? s.turn}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Haritadaki çizginin küçük örneği: profil, renk yanında kalınlık ve kesiklikle de tanınır. */
function LineSwatch({ k }: { k: ProfileKey }) {
  const s = PROFILE_LINE[k];
  const w = Math.min(s.width, 8);
  return (
    <svg width="40" height="12" viewBox="0 0 40 12" aria-hidden="true" className="shrink-0">
      <line
        x1="2"
        y1="6"
        x2="38"
        y2="6"
        stroke={s.color}
        strokeWidth={w}
        strokeLinecap={s.dash ? 'butt' : 'round'}
        strokeDasharray={s.dash ? s.dash.map((d) => d * w).join(' ') : undefined}
      />
    </svg>
  );
}

/**
 * Aynı başlangıç ve hedef için dört profilin rotası yan yana. En kısa rotaya göre fark, aynı çıkan rotalar ve
 * profilin rotayı neden değiştirdiği yazılır; "Bu profil" ile simülasyonun profili seçilir.
 */
function CompareTable({ rows, selected, onSelect }: { rows: ProfileRoute[]; selected: ProfileKey; onSelect: (k: ProfileKey) => void }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Karşılaştırma hazır değil</EmptyTitle>
              <EmptyDescription>Karşılaştırma için pilot alanda bir başlangıç seçin.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }
  const lengths = rows.flatMap((r) => (r.stats ? [r.stats.lengthM] : []));
  const shortest = lengths.length ? Math.min(...lengths) : 0;
  return (
    <Card aria-labelledby="rt-compare">
      <CardHeader>
        <CardTitle id="rt-compare">Profil karşılaştırması</CardTitle>
        <CardDescription>Seçili profilin çizgisi haritada öne çıkar; simülasyon bu profille yürür.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Profil</TableHead>
              <TableHead scope="col">Uzunluk · süre</TableHead>
              <TableHead scope="col">Basamak</TableHead>
              <TableHead scope="col">Ana cadde · zemin</TableHead>
              <TableHead scope="col">Uğrama</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Seçim</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const sig = r.plan?.route.segmentIds.join(',') ?? '';
              const same = r.plan
                ? rows.find(
                    (o) =>
                      o !== r &&
                      o.plan &&
                      o.plan.route.segmentIds.join(',') === sig &&
                      PROFILE_KEYS.indexOf(o.key) < PROFILE_KEYS.indexOf(r.key),
                  )
                : undefined;
              const diff = r.stats ? Math.round(r.stats.lengthM - shortest) : 0;
              const isSelected = r.key === selected;
              return (
                <Fragment key={r.key}>
                  <TableRow aria-current={isSelected ? 'true' : undefined} className={cn('border-b-0', isSelected && 'bg-primary/20')}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <LineSwatch k={r.key} />
                        <span className="font-semibold">{PROFILE_LABEL[r.key]}</span>
                      </div>
                    </TableCell>
                    {r.plan && r.stats ? (
                      <>
                        <TableCell className="num">
                          {formatDistance(r.stats.lengthM, 'tr')} · ~{r.minutes} dk
                          <div className="text-xs text-muted-foreground">
                            {diff === 0 ? 'En kısa' : `+${diff} m`} · {r.plan.steps.length} talimat
                          </div>
                        </TableCell>
                        <TableCell className="num">{r.stats.stairs === 0 ? 'Yok' : r.stats.stairs}</TableCell>
                        <TableCell className="num">
                          Cadde {r.stats.busyM} m
                          <div className="text-xs text-muted-foreground">Arnavut {r.stats.cobbleM} m</div>
                        </TableCell>
                        <TableCell className="num">
                          {r.plan.via.pointIds.length} nokta
                          <div className="text-xs text-muted-foreground">
                            {r.plan.via.extraM > 0 ? `+${r.plan.via.extraM} m` : r.plan.via.pointIds.length ? 'yol üstünde' : ''}
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={4} className="text-muted-foreground">
                        Bu profil için rota bulunamadı.
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={isSelected}
                        onClick={() => onSelect(r.key)}
                      >
                        {isSelected ? 'Seçili' : 'Bu profil'}
                      </Button>
                    </TableCell>
                  </TableRow>
                  <TableRow className={cn(isSelected && 'bg-primary/20')}>
                    <TableCell colSpan={6} className="pt-0 text-xs text-muted-foreground">
                      {PROFILE_LINE[r.key].style} · {PROFILE_WHY[r.key]}
                      {same ? ` ${PROFILE_LABEL[same.key]} ile aynı rota.` : ''}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
