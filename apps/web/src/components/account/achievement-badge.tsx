"use client";

import {
  THRESHOLDS,
  type Achievement,
  type AchievementKind,
} from "@sezi/shared";
import {
  Camera,
  Flag,
  Footprints,
  Landmark,
  Lock,
  Map,
  Route,
  Shapes,
  Share2,
  Stamp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";

const ICONS: Record<AchievementKind, LucideIcon> = {
  first_stamp: Stamp,
  stamps: Stamp,
  types: Shapes,
  cities: Map,
  walker: Footprints,
  complex: Landmark,
  tour: Route,
  reporter: Flag,
  photographer: Camera,
  sharer: Share2,
  companion: Users,
};
export function AchievementBadge({
  achievement,
}: {
  achievement: Achievement;
}) {
  const { t, lang } = useT();
  const item = achievement;
  const earned = item.level > 0;
  const Icon = earned ? ICONS[item.kind] : Lock;
  const name = item.subject
    ? (item.subject.name[lang] ?? item.subject.name.tr)
    : "";
  const thresholds =
    item.kind === "complex" || item.kind === "tour"
      ? [item.current]
      : THRESHOLDS[item.kind];
  const target =
    item.nextTarget ?? thresholds[thresholds.length - 1] ?? item.current;
  const title = t(`ach.${item.kind}.title`, { name });
  const state = earned
    ? `${t("ach.earned")}${item.earnedAt ? `, ${formatDate(lang, item.earnedAt)}` : ""}`
    : t("ach.locked");
  return (
    <Card aria-label={`${title}. ${state}. ${item.current} / ${target}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted">
            <Icon className="size-6" aria-hidden />
          </span>
          <div className="grid gap-1">
            <CardTitle>{title}</CardTitle>
            <Badge variant="secondary">
              {earned
                ? t("ach.level", { level: item.level, max: item.maxLevel })
                : t("ach.locked")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {t(`ach.${item.kind}.body`, { n: target, name })}
        </p>
        {earned && item.earnedAt ? (
          <p className="text-sm">{formatDate(lang, item.earnedAt)}</p>
        ) : null}
        {item.nextTarget !== null ? (
          <ProgressBar
            value={item.current}
            max={item.nextTarget}
            label={title}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
