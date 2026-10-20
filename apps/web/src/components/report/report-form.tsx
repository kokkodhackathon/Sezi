"use client";

import { A11yReportType, boundsOf, loc, toneForType, type LngLat } from "@sezi/shared";
import { AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";

import { ChoiceGroup, type Choice } from "@/components/choice-group";
import { SeziMap, type MapMarker } from "@/components/map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NavOverlay } from "@/lib/data";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { planner, usePlannerOverlay } from "@/lib/pilot";
import { browserSupabase } from "@/lib/supabase-browser";

export type ReportType = z.infer<typeof A11yReportType>;

export const REPORT_DEVICE_KEY = "sezi.web.device.v1";
const NOTE_MAX = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABEL_KEYS: Record<ReportType, MessageKey> = {
  stairs: "report.type.stairs",
  ramp_blocked: "report.type.ramp_blocked",
  narrow_path: "report.type.narrow_path",
  surface_damage: "report.type.surface_damage",
  construction: "report.type.construction",
  other: "report.type.other",
};

const ErrorObjectSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  name: z.string().optional(),
});

export type ReportErrorKey = "report.err.rateLimited" | "report.err.network" | "report.err.generic";

/**
 * Cihaz kimliği: yalnızca kötüye kullanım sınırı için (saatte en çok 10 bildirim); kişisel bilgi taşımaz.
 */
export function getReportDeviceId(): string {
  try {
    const existing = localStorage.getItem(REPORT_DEVICE_KEY);
    if (existing && UUID_RE.test(existing)) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(REPORT_DEVICE_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Supabase ya da ağ hatasını kullanıcıya gösterilecek metin anahtarına eşler.
 * `23505` (aynı kimlik zaten kayıtlı) başarılı sayılır.
 */
export function mapReportError(err: unknown): "ok" | ReportErrorKey {
  if (!err) return "ok";
  if (err instanceof TypeError) return "report.err.network";
  const parsed = ErrorObjectSchema.safeParse(err);
  if (parsed.success) {
    const { code, message = "", name = "" } = parsed.data;
    if (code === "23505") return "ok";
    if (message.includes("Çok fazla bildirim")) return "report.err.rateLimited";
    if (
      name === "TypeError" ||
      name === "AuthRetryableFetchError" ||
      /fetch|network|failed to fetch|load failed/i.test(message)
    ) {
      return "report.err.network";
    }
  }
  return "report.err.generic";
}

interface PilotWorkOption {
  slug: string;
  name: string;
  typeSlug: string;
  location: LngLat;
}

export function ReportForm({
  overlay,
  initialWorkSlug,
}: {
  overlay: NavOverlay;
  initialWorkSlug?: string;
}) {
  const version = usePlannerOverlay(overlay);
  const { t, lang } = useT();

  const works = useMemo<PilotWorkOption[]>(() => {
    const list: PilotWorkOption[] = [];
    for (const n of planner.pilotWorks) {
      if (!n.workSlug) continue;
      list.push({
        slug: n.workSlug,
        name: loc(n.name, lang),
        typeSlug: n.workType ?? "",
        location: n.location,
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [lang, version]);

  const initialWork = useMemo(
    () => (initialWorkSlug ? works.find((w) => w.slug === initialWorkSlug) ?? null : null),
    [initialWorkSlug, works],
  );

  const [workSlug, setWorkSlug] = useState<string>(() => initialWork?.slug ?? "");
  const [pickedPoint, setPickedPoint] = useState<LngLat | null>(null);
  const [segmentKey, setSegmentKey] = useState<string | null>(() =>
    initialWork ? planner.nearestSegmentId(initialWork.location) : null,
  );
  const [type, setType] = useState<ReportType>("stairs");
  const [note, setNote] = useState("");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const selectedWork = useMemo(
    () => (workSlug ? works.find((w) => w.slug === workSlug) ?? null : null),
    [workSlug, works],
  );

  const highlight = useMemo(
    () => (segmentKey ? planner.segmentCoords(segmentKey) : null),
    [segmentKey, version],
  );

  const bounds = useMemo(
    () => (highlight && highlight.length >= 2 ? boundsOf(highlight) : null),
    [highlight],
  );

  const markers = useMemo<MapMarker[]>(() => {
    const items: MapMarker[] = works.map((w) => ({
      id: w.slug,
      location: w.location,
      label: w.name,
      tone: toneForType(w.typeSlug),
      selected: w.slug === workSlug,
      emphasis: w.slug === workSlug ? "dest" : undefined,
    }));
    if (pickedPoint) {
      items.push({
        id: "__picked__",
        location: pickedPoint,
        emphasis: "picked",
      });
    }
    return items;
  }, [works, workSlug, pickedPoint]);

  const choices = useMemo<Choice<ReportType>[]>(
    () =>
      A11yReportType.options.map((value) => ({
        value,
        label: t(TYPE_LABEL_KEYS[value]),
      })),
    [t],
  );

  const selectWork = (slug: string) => {
    setSubmitError(null);
    if (!slug) {
      setWorkSlug("");
      setPickedPoint(null);
      setSegmentKey(null);
      return;
    }
    const found = works.find((w) => w.slug === slug);
    if (!found) return;
    setWorkSlug(found.slug);
    setPickedPoint(null);
    setSegmentKey(planner.nearestSegmentId(found.location));
    setLocationError(null);
  };

  const handleMapClick = (lngLat: LngLat) => {
    setSubmitError(null);
    if (!planner.inPilotArea(lngLat)) {
      setLocationError(t("report.outOfPilot"));
      setWorkSlug("");
      setPickedPoint(null);
      setSegmentKey(null);
      return;
    }
    const nearest = planner.nearestSegmentId(lngLat);
    setWorkSlug("");
    setPickedPoint(lngLat);
    setSegmentKey(nearest);
    setLocationError(null);
  };
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitError(null);
    if (!segmentKey) {
      setLocationError(t("report.needLocation"));
      return;
    }
    setSubmitting(true);
    try {
      const trimmed = note.trim().slice(0, NOTE_MAX);
      const { error } = await browserSupabase().from("a11y_reports").insert({
        id: crypto.randomUUID(),
        area: planner.area,
        segment_key: segmentKey,
        type,
        note: trimmed || null,
        work_slug: workSlug || null,
        device_id: getReportDeviceId(),
      });
      const outcome = mapReportError(error);
      if (outcome === "ok") {
        setSent(true);
      } else {
        setSubmitError(t(outcome));
      }
    } catch (err) {
      const outcome = mapReportError(err);
      if (outcome === "ok") {
        setSent(true);
      } else {
        setSubmitError(t(outcome));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSent(false);
    setNote("");
    setSubmitError(null);
    setLocationError(null);
  };

  if (sent) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="grid gap-4 p-6" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
            <div className="grid gap-1">
              <h2 className="font-heading text-xl font-extrabold">{t("report.sent")}</h2>
              <p className="text-sm text-muted-foreground">{t("report.sentBody")}</p>
            </div>
          </div>
          <div>
            <Button type="button" onClick={handleReset}>
              {t("report.new")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} noValidate className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="report-work" className="font-heading text-sm font-bold">
                {t("report.workLabel")}
              </Label>
              <p id="report-where-help" className="text-xs text-muted-foreground">
                {t("report.whereHelp")}
              </p>
              <select
                id="report-work"
                value={workSlug}
                onChange={(e) => selectWork(e.target.value)}
                aria-describedby={locationError ? "report-where-help report-location-error" : "report-where-help"}
                aria-invalid={Boolean(locationError)}
                className="min-h-12 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              >
                <option value="">{t("report.workPlaceholder")}</option>
                {works.map((w) => (
                  <option key={w.slug} value={w.slug}>
                    {w.name}
                  </option>
                ))}
              </select>

              {segmentKey ? (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
                  <MapPin aria-hidden="true" className="size-4 shrink-0 text-link" />
                  <span className="font-medium">
                    {selectedWork ? t("report.near", { name: selectedWork.name }) : t("report.pickedOnMap")}
                  </span>
                  <Badge variant="outline">{t("report.segmentLabel", { segment: segmentKey })}</Badge>
                </div>
              ) : null}

              {locationError ? (
                <Alert id="report-location-error" variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription>{locationError}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <ChoiceGroup
              legend={t("report.type")}
              value={type}
              onChange={(next) => {
                setType(next);
                setSubmitError(null);
              }}
              choices={choices}
            />

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="report-note" className="font-heading text-sm font-bold">
                  {t("report.note")}
                </Label>
                <span id="report-note-count" className="text-xs text-muted-foreground" aria-live="off">
                  {t("report.noteCount", { n: note.length })}
                </span>
              </div>
              <Textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                maxLength={NOTE_MAX}
                rows={4}
                placeholder={t("report.notePlaceholder")}
                aria-describedby="report-note-help report-note-count"
              />
              <p id="report-note-help" className="text-xs text-muted-foreground">
                {t("report.noteHelp")}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">{t("report.noAccountNote")}</p>

            {submitError ? (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t("report.title")}</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
              {submitting ? t("report.submitting") : t("report.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        <SeziMap
          label={t("report.mapLabel")}
          center={selectedWork?.location ?? pickedPoint ?? planner.center}
          zoom={16}
          bounds={bounds}
          markers={markers}
          highlight={highlight}
          onMarkerClick={(id) => {
            if (id !== "__picked__") selectWork(id);
          }}
          onMapClick={handleMapClick}
          className="h-[420px] w-full"
        />
        <p className="text-xs text-muted-foreground">{t("report.mapHelp")}</p>
      </div>
    </div>
  );
}
