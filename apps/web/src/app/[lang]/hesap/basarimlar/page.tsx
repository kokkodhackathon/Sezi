"use client";

import { AchievementBadge } from "@/components/account/achievement-badge";
import { usePassportData } from "@/components/account/passport-content";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import { useT } from "@/lib/i18n-client";

export default function AchievementsPage() {
  const { t } = useT();
  const { ready, user } = useSocialAccount();
  const result = usePassportData(user?.id);
  if (!ready || !user) return null;
  return (
    <SocialShell
      title="ach.title"
      loading={result.loading}
      error={result.error}
    >
      {[true, false].map((earned) => (
        <section key={String(earned)} className="grid gap-4">
          <h2 className="font-heading text-lg font-bold">
            {t(earned ? "ach.earned" : "ach.locked")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {result.data?.list
              .filter((item) => item.level > 0 === earned)
              .map((item) => (
                <AchievementBadge key={item.id} achievement={item} />
              ))}
          </div>
        </section>
      ))}
    </SocialShell>
  );
}
