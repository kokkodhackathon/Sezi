"use client";

import type { IdentityPatch, Visibility } from "@sezi/shared";
import Link from "next/link";
import { useState } from "react";

import { AccountNote, FormError } from "@/components/account/form-error";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import { ChoiceGroup, type Choice } from "@/components/choice-group";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
  const choices: Choice<Visibility>[] = [
    { value: "private", label: t("account.visPrivate") },
    { value: "friends", label: t("account.visFriends") },
    { value: "public", label: t("account.visPublic") },
  ];
  const photoChoices: Choice<Visibility>[] = [
    { value: "private", label: t("photos.private") },
    { value: "friends", label: t("photos.friends") },
    { value: "public", label: t("photos.public") },
  ];
  if (!ready || !user) return null;
  return (
    <SocialShell
      title="privacy.title"
      loading={loading || blocked.loading}
      error={blocked.error}
    >
      <div className="flex flex-col gap-8">
        <FormError text={failed ? t("friends.error") : null} />
        <p role="status" className="text-sm text-muted-foreground">
          {saved ? t("privacy.saved") : null}
        </p>
        {identity ? (
          <fieldset disabled={busy} className="min-w-0">
            <legend className="sr-only">{t("privacy.title")}</legend>
            <FieldGroup>
              <ChoiceGroup
                legend={t("privacy.visibility")}
                choices={choices}
                value={identity.visibility}
                onChange={(visibility) => update({ visibility })}
              />
              <AccountNote
                text={t(
                  identity.visibility === "private"
                    ? "privacy.vis.private"
                    : identity.visibility === "friends"
                      ? "privacy.vis.friends"
                      : "privacy.vis.public",
                )}
              />
              <Field
                orientation="horizontal"
                data-disabled={busy}
                className="min-h-12"
              >
                <FieldContent>
                  <FieldLabel htmlFor="privacy-findable" className="min-h-12">
                    {t("privacy.findable")}
                  </FieldLabel>
                  <FieldDescription>
                    {t("privacy.findableHelp")}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="privacy-findable"
                  checked={identity.findable}
                  disabled={busy}
                  onCheckedChange={(findable) => update({ findable })}
                />
              </Field>
              <ChoiceGroup
                legend={t("privacy.photoDefault")}
                choices={photoChoices}
                value={identity.photo_default}
                onChange={(photo_default) => update({ photo_default })}
              />
              <p className="text-sm text-muted-foreground">
                {t("privacy.photoDefaultHelp")}
              </p>
            </FieldGroup>
          </fieldset>
        ) : null}
        <section aria-labelledby="blocked-title" className="border-t pt-6">
          <h2 id="blocked-title" className="text-xl font-bold">
            {t("privacy.blocked")}
          </h2>
          {blocked.data?.length ? (
            <ul className="divide-y">
              {blocked.data.map(({ id, person }) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <Link
                    href={href(lang, `/kisi/${id}`)}
                    className="min-h-12 content-center font-semibold underline-offset-4 hover:underline"
                  >
                    {person?.display_name ?? t("person.notFound")}
                    {person?.username ? ` (@${person.username})` : null}
                  </Link>
                  <Button
                    className="min-h-12"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => unblock(id))}
                  >
                    {t("person.unblock")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{t("privacy.noBlocks")}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
        <AccountNote text={t("privacy.location")} />
      </div>
    </SocialShell>
  );
}
