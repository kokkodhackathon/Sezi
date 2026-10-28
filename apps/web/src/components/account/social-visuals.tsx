"use client";

import {
  badgeFor,
  glyphSvgBody,
  THRESHOLDS,
  toneForType,
  type Achievement,
  type BadgeId,
  type LocalizedText,
  type UserPhoto,
  type Visibility,
  type Visit,
} from "@sezi/shared";
import {
  Archive,
  Camera,
  Check,
  Clock,
  Globe,
  Lock,
  User,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { RadioGroup as RadioPrimitive } from "radix-ui";
import { useState, type ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatDate, href, type Lang, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { cn } from "@/lib/utils";

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const TONE_CLASS = {
  cobalt: "bg-tone-cobalt text-tone-cobalt-ink",
  teal: "bg-tone-teal text-tone-teal-ink",
  coral: "bg-tone-coral text-tone-coral-ink",
  saffron: "bg-tone-saffron text-tone-saffron-ink",
  sage: "bg-tone-sage text-tone-sage-ink",
  plum: "bg-tone-plum text-tone-plum-ink",
} as const;

/** Damga eğimi: slug'dan belirlenir (−3°…+3°), mobilde aynı kural. */
export function stampTilt(slug: string): number {
  let sum = 0;
  for (let i = 0; i < slug.length; i++) sum += slug.charCodeAt(i);
  return (sum % 7) - 3;
}

/** Eser türü glifi (çizim verisi `shared/glyphs.ts`); renk `currentColor`. Dekoratif. */
export function TypeGlyph({ slug, className }: { slug: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      // Glif verisi paylaşılan sabit çizimdir (kullanıcı girdisi değil).
      dangerouslySetInnerHTML={{ __html: glyphSvgBody(slug, "currentColor") }}
    />
  );
}

/** Ziyaret damgası: tür tonunda kare, içte kesikli mühür çizgisi, tür glifi, hafif eğik. Dekoratif. */
export function Stamp({ slug, typeSlug, className }: { slug: string; typeSlug: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ rotate: `${stampTilt(slug)}deg` }}
      className={cn(
        "grid aspect-square place-items-center rounded-xl p-1.5 contrast:bg-card contrast:text-foreground contrast:outline-2 contrast:outline-border",
        TONE_CLASS[toneForType(typeSlug)],
        className,
      )}
    >
      <span className="grid size-full place-items-center rounded-lg border-[1.5px] border-dashed border-current">
        <TypeGlyph slug={typeSlug} className="size-1/2" />
      </span>
    </span>
  );
}

export function EmptyStamp({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block aspect-square rounded-xl border-2 border-dashed border-border", className)} />;
}

export function EmptyPassportArt() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-3">
      <EmptyStamp className="size-14 -rotate-3" />
      <EmptyStamp className="size-[4.5rem]" />
      <EmptyStamp className="size-14 rotate-3" />
    </div>
  );
}

export function EmptyPhotoArt() {
  return (
    <div aria-hidden className="grid size-24 place-items-center rounded-xl border-2 border-dashed border-border text-muted-foreground">
      <Camera className="size-9" />
    </div>
  );
}

export function FriendsArt() {
  const circle = "grid size-16 place-items-center rounded-full border-4 border-background contrast:bg-card contrast:text-foreground contrast:outline-2 contrast:outline-border";
  return (
    <div aria-hidden className="flex items-center justify-center">
      <span className={cn(circle, "z-10 bg-highlight text-highlight-foreground")}>
        <User className="size-7" fill="currentColor" />
      </span>
      <span className={cn(circle, "-ml-4 bg-tone-saffron text-tone-saffron-ink")}>
        <User className="size-7" fill="currentColor" />
      </span>
    </div>
  );
}

export function LockedArt() {
  return (
    <div aria-hidden className="grid size-24 place-items-center rounded-full bg-muted text-muted-foreground contrast:outline-2 contrast:outline-border">
      <Lock className="size-9" />
    </div>
  );
}

/** Boş durum: çizim + tek kısa cümle + isteğe bağlı tek eylem. */
export function EmptyInvite({ art, text, action }: { art: ReactNode; text: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-4 py-8 text-center">
      {art}
      <p className="font-heading text-lg font-bold">{text}</p>
      {action}
    </div>
  );
}

/** Sayı şeridi: simge + büyük sayı + tek sözcük. */
export function StatStrip({ items }: { items: { icon: LucideIcon; value: string; label: string }[] }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
      {items.map(({ icon: Icon, value, label }) => (
        <div key={label} className="grid gap-0.5 rounded-lg bg-muted p-3 contrast:outline-2 contrast:outline-border">
          <Icon aria-hidden className="size-5 text-link" />
          <dd className="font-heading text-2xl font-extrabold">{value}</dd>
          <dt className="text-sm text-muted-foreground">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

const subjectName = (a: Achievement, lang: Lang) => (a.subject ? (a.subject.name[lang] ?? a.subject.name.tr) : "");

const BADGE_NAME = {
  "01-ilk-damga": "badge.01-ilk-damga.name",
  "02-vakif-kasifi": "badge.02-vakif-kasifi.name",
  "03-uslup-avcisi": "badge.03-uslup-avcisi.name",
  "04-sehirler-arasi": "badge.04-sehirler-arasi.name",
  "05-ilk-kilometre": "badge.05-ilk-kilometre.name",
  "06-carsi-ehli": "badge.06-carsi-ehli.name",
  "07-kervan-yolcusu": "badge.07-kervan-yolcusu.name",
  "08-kuzey-ruzgari": "badge.08-kuzey-ruzgari.name",
  "09-sessiz-minareler": "badge.09-sessiz-minareler.name",
  "10-kubbeler-altinda": "badge.10-kubbeler-altinda.name",
  "11-erisilebilirlik-elcisi": "badge.11-erisilebilirlik-elcisi.name",
  "12-arsiv-gozu": "badge.12-arsiv-gozu.name",
  "13-ilk-kare": "badge.13-ilk-kare.name",
  "14-yol-arkadasi": "badge.14-yol-arkadasi.name",
} as const satisfies Record<BadgeId, MessageKey>;

export function achievementTitle(a: Achievement, t: Translate, lang: Lang) {
  const badge = t(BADGE_NAME[badgeFor(a)]);
  if ((a.kind === "complex" || a.kind === "tour") && a.subject) return `${badge} · ${subjectName(a, lang)}`;
  return badge;
}

export function achievementTarget(a: Achievement) {
  const thresholds = a.kind === "complex" || a.kind === "tour" ? null : THRESHOLDS[a.kind];
  return a.nextTarget ?? thresholds?.[thresholds.length - 1] ?? a.current;
}

export function achievementLabel(a: Achievement, t: Translate, lang: Lang) {
  const title = achievementTitle(a, t, lang);
  if (a.level > 0) return `${title}. ${t("ach.earnedStatus")}${a.earnedAt ? `, ${formatDate(lang, a.earnedAt)}` : ""}`;
  return `${title}. ${t("ach.locked")}, ${a.current} / ${achievementTarget(a)}`;
}

/** Başarım karosu: kazanılanda firuze dolgu + köşede tik, kilitlide soluk dolgu + köşede kilit. Dekoratif. */
export function AchievementIcon({ achievement: a, size = "md" }: { achievement: Achievement; size?: "sm" | "md" | "lg" }) {
  const earned = a.level > 0;
  const badge = badgeFor(a);
  const Mark = earned ? Check : Lock;
  const box = { sm: "size-14 rounded-xl", md: "size-[4.5rem] rounded-2xl", lg: "size-24 rounded-3xl" }[size];
  return (
    <span aria-hidden className="relative inline-block">
      <span
        className={cn(
          "grid place-items-center overflow-hidden bg-muted contrast:bg-card contrast:outline-2 contrast:outline-border",
          box,
        )}
      >
        <img
          src={`/badges/${badge}.${badge === "08-kuzey-ruzgari" ? "webp" : "svg"}`}
          alt=""
          className={cn("size-full object-cover", !earned && "grayscale opacity-50")}
        />
      </span>
      <span
        className={cn(
          "absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border-2",
          earned ? "border-card bg-link text-background" : "border-border bg-card text-muted-foreground",
        )}
      >
        <Mark className="size-3.5" strokeWidth={3} />
      </span>
      {earned && a.level > 1 ? (
        <span className="absolute -bottom-1.5 -left-1.5 rounded-full border bg-card px-1.5 text-xs font-bold">×{a.level}</span>
      ) : null}
    </span>
  );
}

/** Başarım ızgarası: karo + kısa ad (kilitlide ince çubuk ve oran); tıklayınca ayrıntı penceresi. */
export function AchievementGrid({ list }: { list: Achievement[] }) {
  const { t, lang } = useT();
  const [open, setOpen] = useState<Achievement | null>(null);
  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-4">
        {list.map((a) => {
          const title = achievementTitle(a, t, lang);
          const target = achievementTarget(a);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setOpen(a)}
                aria-label={achievementLabel(a, t, lang)}
                aria-haspopup="dialog"
                className="grid min-h-12 w-full justify-items-center gap-2 rounded-xl p-2 text-center outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
              >
                <AchievementIcon achievement={a} />
                <span aria-hidden className={cn("line-clamp-2 text-sm font-semibold", a.level === 0 && "text-muted-foreground")}>
                  {title}
                </span>
                {a.level === 0 ? (
                  <span aria-hidden className="grid w-full gap-1">
                    <span className="h-1.5 overflow-hidden rounded-full bg-border">
                      <span className="block h-full bg-link" style={{ width: `${target ? Math.min(100, (a.current / target) * 100) : 0}%` }} />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {a.current}/{target}
                    </span>
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Dialog open={!!open} onOpenChange={(value) => !value && setOpen(null)}>
        <DialogContent className="sm:max-w-sm">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{achievementTitle(open, t, lang)}</DialogTitle>
                <DialogDescription>{t(`ach.${open.kind}.body`, { n: achievementTarget(open), name: subjectName(open, lang) })}</DialogDescription>
              </DialogHeader>
              <div className="grid justify-items-center gap-4 py-2">
                <AchievementIcon achievement={open} size="lg" />
                {open.level > 0 ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Check aria-hidden className="size-4 text-link" />
                    {open.earnedAt ? formatDate(lang, open.earnedAt) : t("ach.earnedStatus")}
                  </p>
                ) : (
                  <div className="w-full">
                    <ProgressBar value={open.current} max={achievementTarget(open)} label={achievementTitle(open, t, lang)} />
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function sortAchievements(list: Achievement[]) {
  const earned = list.filter((a) => a.level > 0).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
  const locked = list.filter((a) => a.level === 0).sort((a, b) => b.current / (b.nextTarget || 1) - a.current / (a.nextTarget || 1));
  return { earned, locked };
}

type StampWork = { slug: string; name: LocalizedText; type_slug: string };

/** Damga ızgarası: eğik damgalar, altında tek satır ad; eser sayfasına bağlantı. */
export function StampGrid({ visits, works, limit }: { visits: Visit[]; works: Map<string, StampWork>; limit?: number }) {
  const { t, lang } = useT();
  const items = [...visits]
    .filter((visit) => works.has(visit.work_slug))
    .sort((a, b) => b.first_at.localeCompare(a.first_at))
    .slice(0, limit);
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-4">
      {items.map((visit) => {
        const work = works.get(visit.work_slug)!;
        const name = work.name[lang] ?? work.name.tr;
        const method = t(visit.method === "checkin" ? "passport.byCheckin" : "passport.byRoute");
        return (
          <li key={visit.work_slug}>
            <Link
              href={href(lang, `/eser/${work.slug}`)}
              aria-label={`${name}, ${formatDate(lang, visit.first_at)}, ${method}`}
              className="grid min-h-12 justify-items-center gap-2 rounded-xl p-2 text-center outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
            >
              <Stamp slug={work.slug} typeSlug={work.type_slug} className="w-full max-w-24" />
              <span aria-hidden className="line-clamp-1 text-sm font-semibold">
                {name}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Görünürlük → simge (mobilde aynı). */
export const VISIBILITY_ICONS: Record<Visibility, LucideIcon> = { private: Lock, friends: Users, public: Globe };

/** Fotoğraf durumu: görünürlük + (herkese açıksa) inceleme + arşiv; simge ve sözcük. */
export function photoStatus(photo: UserPhoto, t: Translate): { icon: LucideIcon; label: string }[] {
  const out = [{ icon: VISIBILITY_ICONS[photo.visibility], label: t(`photos.${photo.visibility}`) }];
  if (photo.visibility === "public") {
    const icon = { none: Clock, pending: Clock, approved: Check, rejected: X }[photo.review];
    out.push({ icon, label: t(`photos.review.${photo.review}`) });
  }
  if (photo.archive === "accepted" || photo.archive === "suggested") out.push({ icon: Archive, label: t(`photos.archive.${photo.archive}`) });
  return out;
}

/** Fotoğraf köşesindeki durum simgeleri; anlamı üst öğenin etiketinde. */
export function StatusDots({ items }: { items: { icon: LucideIcon; label: string }[] }) {
  return (
    <span aria-hidden className="absolute right-2 top-2 flex gap-1">
      {items.map(({ icon: Icon, label }) => (
        <span key={label} className="grid size-7 place-items-center rounded-full border bg-card text-foreground">
          <Icon className="size-4" />
        </span>
      ))}
    </span>
  );
}

/** Durum çipleri (ayrıntı sayfasında): simge + sözcük. */
export function StatusChips({ items }: { items: { icon: LucideIcon; label: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map(({ icon: Icon, label }) => (
        <li key={label} className="flex min-h-9 items-center gap-1.5 rounded-md bg-muted px-3 text-sm contrast:outline-2 contrast:outline-border">
          <Icon aria-hidden className="size-4" />
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Görünürlük seçimi: simgeli seçenek kutucukları (gerçek radyo grubu, ok tuşlarıyla gezilir).
 * Seçili: firuze dolgu + kalın yazı + tik. `stack` gizlilik ekranındaki büyük kartlar.
 */
export function VisibilityChoice({
  value,
  onChange,
  label,
  labels,
  stack,
  disabled,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
  label: string;
  labels: Record<Visibility, string>;
  stack?: boolean;
  disabled?: boolean;
}) {
  const options: Visibility[] = ["private", "friends", "public"];
  return (
    <RadioPrimitive.Root
      aria-label={label}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        const hit = options.find((option) => option === next);
        if (hit) onChange(hit);
      }}
      className={cn("grid gap-2", stack ? "sm:grid-cols-3" : "grid-cols-3")}
    >
      {options.map((option) => {
        const Icon = VISIBILITY_ICONS[option];
        const on = option === value;
        return (
          <RadioPrimitive.Item
            key={option}
            value={option}
            aria-label={labels[option]}
            className={cn(
              "relative flex min-h-16 items-center gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring disabled:opacity-50",
              !stack && "flex-col justify-center gap-1 px-2 text-center",
              on ? "bg-highlight font-bold text-highlight-foreground contrast:outline-3" : "bg-muted hover:bg-border/60",
              "contrast:bg-card contrast:text-foreground contrast:outline-2 contrast:outline-border",
            )}
          >
            <Icon aria-hidden className="size-6 shrink-0" />
            <span className={cn(stack && "flex-1")}>{labels[option]}</span>
            {on ? <Check aria-hidden className={cn("size-4", !stack && "absolute right-2 top-2")} strokeWidth={3} /> : null}
          </RadioPrimitive.Item>
        );
      })}
    </RadioPrimitive.Root>
  );
}
