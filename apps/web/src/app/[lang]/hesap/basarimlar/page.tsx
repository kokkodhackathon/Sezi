"use client";

import { usePassportData } from "@/components/account/passport-content";
import { SocialShell, useSocialAccount } from "@/components/account/social-shell";
import { AchievementGrid, sortAchievements } from "@/components/account/social-visuals";
import { useT } from "@/lib/i18n-client";

/** Başarımlar: kazanılanlar ve sıradakiler; karoya tıklayınca ayrıntı penceresi. */
export default function AchievementsPage() {
  const { t } = useT();
  const { ready, user } = useSocialAccount();
  const result = usePassportData(user?.id);
  if (!ready || !user) return null;
  const { earned, locked } = sortAchievements(result.data?.list ?? []);
  return (
    <SocialShell title="ach.title" loading={result.loading} error={result.error}>
      <section aria-labelledby="earned-heading" className="grid gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="earned-heading" className="font-heading text-lg font-bold">
            {t("ach.earned")}
          </h2>
          <span className="text-sm text-muted-foreground">
            {earned.length}/{earned.length + locked.length}
          </span>
        </div>
        {earned.length ? <AchievementGrid list={earned} /> : <p className="text-muted-foreground">{t("ach.noneEarned")}</p>}
      </section>
      {locked.length ? (
        <section aria-labelledby="next-heading" className="grid gap-4">
          <h2 id="next-heading" className="font-heading text-lg font-bold">
            {t("ach.next")}
          </h2>
          <AchievementGrid list={locked} />
        </section>
      ) : null}
    </SocialShell>
  );
}
