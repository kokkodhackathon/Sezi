"use client";

import type { IdentityPatch } from "@sezi/shared";
import { Ban, Search, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/account/avatar";
import { FormError } from "@/components/account/form-error";
import { SocialShell, useSocialAccount } from "@/components/account/social-shell";
import { VisibilityChoice } from "@/components/account/social-visuals";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import { getBlocks, getPerson, unblock } from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export default function PrivacyPage() {
  const { ready, user } = useSocialAccount();
  const { t, lang } = useT();
  const { identity, loading, save } = useIdentity();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const blocked = useAsync(async () => {
    if (!ready || !user) return [];
    return Promise.all(
      (await getBlocks()).map(async ({ blocked: id }) => ({
        id,
        person: await getPerson(id),
      })),
    );
  }, [ready, user?.id]);
  const act = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setSaved(false);
    try {
      await action();
      setSaved(true);
      blocked.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const update = (patch: IdentityPatch) => {
    void act(() => save(patch));
  };
  const labels = { private: t("photos.private"), friends: t("photos.friends"), public: t("photos.public") };
  if (!ready || !user) return null;
  return (
    <SocialShell title="privacy.title" loading={loading || blocked.loading} error={blocked.error}>
      <div className="flex flex-col gap-8">
        <FormError text={failed ? t("friends.error") : null} />
        <p role="status" className="sr-only">
          {saved ? t("privacy.saved") : null}
        </p>
        {identity ? (
          <>
            <section aria-labelledby="privacy-who" className="grid gap-3">
              <h2 id="privacy-who" className="font-heading text-lg font-bold">
                {t("privacy.who")}
              </h2>
              <VisibilityChoice
                stack
                label={t("privacy.who")}
                value={identity.visibility}
                labels={labels}
                disabled={busy}
                onChange={(visibility) => update({ visibility })}
              />
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t(`privacy.vis.${identity.visibility}`)}
              </p>
            </section>
            <div className="flex min-h-16 items-center gap-4 rounded-xl border bg-card px-4 py-3">
              <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <label htmlFor="privacy-findable" className="grid flex-1 cursor-pointer gap-0.5">
                <span className="font-semibold">{t("privacy.findable")}</span>
                <span className="text-sm text-muted-foreground">{t("privacy.findableHelp")}</span>
              </label>
              <Switch
                id="privacy-findable"
                checked={identity.findable}
                disabled={busy}
                onCheckedChange={(findable) => update({ findable })}
              />
            </div>
            <section aria-labelledby="privacy-photos" className="grid gap-3">
              <h2 id="privacy-photos" className="font-heading text-lg font-bold">
                {t("privacy.photoDefault")}
              </h2>
              <VisibilityChoice
                label={t("privacy.photoDefault")}
                value={identity.photo_default}
                labels={labels}
                disabled={busy}
                onChange={(photo_default) => update({ photo_default })}
              />
            </section>
          </>
        ) : null}
        <section aria-labelledby="blocked-title" className="grid gap-3">
          <h2 id="blocked-title" className="font-heading text-lg font-bold">
            {t("privacy.blocked")}
          </h2>
          {blocked.data?.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {blocked.data.map(({ id, person }) => {
                const name = person?.display_name ?? t("person.notFound");
                return (
                  <li key={id} className="flex items-center gap-3 px-4 py-2">
                    <Link
                      href={href(lang, `/kisi/${id}`)}
                      className="flex min-h-12 flex-1 items-center gap-3 rounded-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring"
                    >
                      <Avatar identity={person} size={40} />
                      <span className="truncate">{name}</span>
                    </Link>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="size-12 rounded-full"
                      aria-label={t("person.unblockName", { name })}
                      disabled={busy}
                      onClick={() => void act(() => unblock(id))}
                    >
                      <Ban aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{t("privacy.noBlocks")}</p>
          )}
        </section>
        <p className="flex items-center gap-2 text-sm">
          <Shield aria-hidden className="size-5 shrink-0 text-link" />
          {t("privacy.location")}
        </p>
      </div>
    </SocialShell>
  );
}
