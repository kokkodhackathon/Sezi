"use client";

import {
  PassportContent,
  usePassportData,
} from "@/components/account/passport-content";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";

export default function PassportPage() {
  const { ready, user } = useSocialAccount();
  const result = usePassportData(user?.id);
  if (!ready || !user) return null;
  return (
    <SocialShell
      title="passport.title"
      loading={result.loading}
      error={result.error}
    >
      {result.data ? <PassportContent data={result.data} /> : null}
    </SocialShell>
  );
}
