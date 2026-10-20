"use client";

import { A11yReportType, boundsOf, loc, toneForType, type LngLat } from "@sezi/shared";
import { AlertCircle, CheckCircle2, LandmarkIcon, MapPin } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";

import { ChoiceGroup, type Choice } from "@/components/choice-group";
import { PlacePicker } from "@/components/route/place-picker";
import { SeziMap, type MapMarker } from "@/components/map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="grid gap-4 rounded-lg border bg-card p-6" role="status" aria-live="polite">
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
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-8">
      {/* Adım 1: Konum (Where) */}
      <section aria-labelledby="step-where-heading" className="grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="step-where-heading" className="font-heading text-base font-bold text-foreground">
            1. {t("report.where")}
          </h2>
          {segmentKey ? (
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <MapPin aria-hidden="true" className="size-3.5" />
              <span>{selectedWork ? t("report.near", { name: selectedWork.name }) : t("report.pickedOnMap")}</span>
            </div>
          ) : null}
        </div>

        <PlacePicker
          id="report-work"
          label={t("report.workLabel")}
          marker={<MapPin className="size-5 text-accent-text" />}
          value={workSlug}
          display={selectedWork?.name ?? t("report.workPlaceholder")}
          options={works.map((w) => ({ value: w.slug, label: w.name, icon: <LandmarkIcon aria-hidden /> }))}
          onChange={selectWork}
        />

        <div className="overflow-hidden rounded-lg border">
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
            className="h-[280px] w-full sm:h-[320px]"
          />
        </div>

        {segmentKey ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{t("report.segmentLabel", { segment: segmentKey })}</Badge>
          </div>
        ) : null}

        {locationError ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{locationError}</AlertDescription>
          </Alert>
        ) : null}
      </section>

      {/* Adım 2: Engel Türü (What) */}
      <section aria-labelledby="step-what-heading" className="grid gap-3 border-t pt-6">
        <h2 id="step-what-heading" className="font-heading text-base font-bold text-foreground">
          2. {t("report.type")}
        </h2>
        <ChoiceGroup
          legend={t("report.type")}
          legendHidden
          value={type}
          onChange={(next) => {
            setType(next);
            setSubmitError(null);
          }}
          choices={choices}
        />
      </section>

      {/* Adım 3: Açıklama (Note) */}
      <section aria-labelledby="step-note-heading" className="grid gap-3 border-t pt-6">
        <div className="flex items-center justify-between gap-2">
          <h2 id="step-note-heading" className="font-heading text-base font-bold text-foreground">
            3. {t("report.note")}
          </h2>
          <span className="text-xs text-muted-foreground num" aria-live="off">
            {t("report.noteCount", { n: note.length })}
          </span>
        </div>
        <Textarea
          id="report-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          rows={3}
          placeholder={t("report.notePlaceholder")}
          aria-label={t("report.note")}
        />
      </section>

      {submitError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>{t("report.title")}</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="pt-2">
        <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto">
          {submitting ? t("report.submitting") : t("report.submit")}
        </Button>
      </div>
    </form>
  );
}
