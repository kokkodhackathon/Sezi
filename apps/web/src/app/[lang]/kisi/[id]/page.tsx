"use client";

import { achievements, friendState, loc, passportStats } from "@sezi/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AchievementBadge } from "@/components/account/achievement-badge";
import { Avatar } from "@/components/account/avatar";
import { AccountNote, FormError } from "@/components/account/form-error";
import {
  SocialShell,
  useSocialAccount,
} from "@/components/account/social-shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { formatDate, formatNumber, href, type MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import {
  accept,
  avatarUrl,
  block,
  getBlocks,
  getContributions,
  getFriendships,
  getPerson,
  getPhotos,
  getTours,
  getVisits,
  getWorks,
  photoUrls,
  removeFriendship,
  sendRequest,
  unblock,
} from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export default function PersonPage() {
  return (
    <Suspense fallback={null}>
      <PersonContent />
    </Suspense>
  );
}

function PersonContent() {
  const { id } = useParams<{ id: string }>();
  const { ready, user } = useSocialAccount();
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<"remove" | "block" | null>(null);
  const profile = useAsync(async () => {
    if (!ready || !user) return null;
    const [person, rows, blocks, contributions] = await Promise.all([
      getPerson(id),
      getFriendships(),
      getBlocks(),
      getContributions(id),
    ]);
    const avatar = await avatarUrl(person?.avatar_path ?? null);
    // Katkı satırının RLS kararı, boş pasaportu gizli profilden ayırır.
    if (!person || !contributions)
      return { person, avatar, rows, blocks, content: null };
    const [visits, works, tours, photos] = await Promise.all([
      getVisits(id),
      getWorks(),
      getTours(),
      getPhotos({ uid: id }),
    ]);
    const urls = await photoUrls(photos.map((photo) => photo.thumb_path));
    return {
      person,
      avatar,
      rows,
      blocks,
      content: {
        visits,
        works,
        photos,
        urls,
        contributions,
        stats: passportStats(visits, works, tours),
        achievements: achievements({
          visits,
          works,
          tours,
          contributions,
        }).filter((item) => item.level >= 1),
      },
    };
  }, [ready, user?.id, id]);
  const act = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      profile.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  if (!ready || !user) return null;
  const data = profile.data;
  const person = data?.person;
  const content = data?.content;
  const blocked = data?.blocks.some((item) => item.blocked === id) ?? false;
  const state = friendState(data?.rows ?? [], user.id, id);
  const row = data?.rows.find(
    (item) =>
      (item.requester === user.id && item.addressee === id) ||
      (item.addressee === user.id && item.requester === id),
  );
  const metrics: { label: MessageKey; value: number | string }[] = content
    ? [
        { label: "person.stamps", value: content.stats.stamps },
        { label: "person.types", value: content.stats.types },
        {
          label: "person.distance",
          value: `${formatNumber(lang, Math.round(content.stats.distanceM))} m`,
        },
        { label: "person.tours", value: content.stats.toursDone.length },
        {
          label: "person.reports",
          value: content.contributions.reports_approved,
        },
        {
          label: "person.archived",
          value: content.contributions.photos_archived,
        },
        {
          label: "person.publicPhotos",
          value: content.contributions.photos_public,
        },
      ]
    : [];
  return (
    <SocialShell
      title="person.title"
      loading={profile.loading}
      error={profile.error}
    >
      <div className="flex flex-col gap-8">
        <FormError text={failed ? t("friends.error") : null} />
        {person ? (
          <>
            <header className="flex flex-wrap items-center gap-4">
              <Avatar identity={person} src={data?.avatar} size={80} />
              <div className="min-w-0">
                <h2 className="break-words text-2xl font-extrabold">
                  {person.display_name}
                </h2>
                {person.username ? (
                  <p className="break-all text-muted-foreground">
                    @{person.username}
                  </p>
                ) : null}
              </div>
            </header>
            {id !== user.id && !blocked ? (
              <div className="flex flex-wrap gap-2">
                {state === "none" ? (
                  <Button
                    className="min-h-12"
                    disabled={busy}
                    onClick={() => void act(() => sendRequest(id))}
                  >
                    {t("friends.add")}
                  </Button>
                ) : null}
                {state === "outgoing" && row ? (
                  <Button
                    className="min-h-12"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(() => removeFriendship(row.id))}
                  >
                    {t("friends.withdraw")}
                  </Button>
                ) : null}
                {state === "incoming" && row ? (
                  <>
                    <Button
                      className="min-h-12"
                      disabled={busy}
                      onClick={() => void act(() => accept(row.id))}
                    >
                      {t("friends.accept")}
                    </Button>
                    <Button
                      className="min-h-12"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void act(() => removeFriendship(row.id))}
                    >
                      {t("friends.reject")}
                    </Button>
                  </>
                ) : null}
                {state === "friends" ? (
                  <>
                    <span className="min-h-12 content-center text-sm">
                      {t("friends.connected")}
                    </span>
                    <Button
                      className="min-h-12"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setConfirm("remove")}
                    >
                      {t("friends.remove")}
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
            {content ? (
              <>
                <section aria-labelledby="person-summary">
                  <h2 id="person-summary" className="mb-4 text-xl font-bold">
                    {t("person.summary")}
                  </h2>
                  <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {metrics.map(({ label, value }) => (
                      <div
                        key={label}
                        className="border-l-2 border-primary pl-3"
                      >
                        <dt className="text-sm text-muted-foreground">
                          {t(label)}
                        </dt>
                        <dd className="text-xl font-bold">
                          {typeof value === "number"
                            ? formatNumber(lang, value)
                            : value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section aria-labelledby="person-achievements">
                  <h2
                    id="person-achievements"
                    className="mb-4 text-xl font-bold"
                  >
                    {t("person.achievements")}
                  </h2>
                  {content.achievements.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {content.achievements.map((achievement) => (
                        <AchievementBadge
                          key={achievement.id}
                          achievement={achievement}
                        />
                      ))}
                    </div>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>{t("person.noAchievements")}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  )}
                </section>
                <section aria-labelledby="person-stamps">
                  <h2 id="person-stamps" className="mb-4 text-xl font-bold">
                    {t("person.latestStamps")}
                  </h2>
                  {content.stats.stamps ? (
                    <ol className="divide-y">
                      {content.visits
                        .filter((visit) =>
                          content.works.some(
                            (work) => work.slug === visit.work_slug,
                          ),
                        )
                        .sort(
                          (a, b) =>
                            Date.parse(b.first_at) - Date.parse(a.first_at),
                        )
                        .slice(0, 10)
                        .map((visit) => {
                          const work = content.works.find(
                            (item) => item.slug === visit.work_slug,
                          );
                          return (
                            <li
                              key={visit.work_slug}
                              className="flex flex-wrap justify-between gap-2 py-3"
                            >
                              <Link
                                href={href(lang, `/eser/${visit.work_slug}`)}
                                className="min-h-12 content-center font-semibold underline-offset-4 hover:underline"
                              >
                                {loc(work?.name, lang)}
                              </Link>
                              <time
                                dateTime={visit.first_at}
                                className="content-center text-sm text-muted-foreground"
                              >
                                {formatDate(lang, visit.first_at)}
                              </time>
                            </li>
                          );
                        })}
                    </ol>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>{t("person.noStamps")}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  )}
                </section>
                <section aria-labelledby="person-photos">
                  <h2 id="person-photos" className="mb-4 text-xl font-bold">
                    {t("person.photos")}
                  </h2>
                  {content.photos.length ? (
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                      {content.photos.map((photo) => (
                        <li key={photo.id}>
                          <Link
                            href={href(lang, `/hesap/fotograflar/${photo.id}`)}
                            className="flex flex-col gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {content.urls[photo.thumb_path] ? (
                              <img
                                src={content.urls[photo.thumb_path]}
                                alt={photo.alt_text}
                                width={photo.width}
                                height={photo.height}
                                className="aspect-square w-full rounded-lg object-cover"
                              />
                            ) : (
                              <span className="aspect-square content-center rounded-lg bg-muted p-3 text-sm">
                                {photo.alt_text}
                              </span>
                            )}
                            {photo.caption ? (
                              <p className="text-sm">{photo.caption}</p>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>{t("person.noPhotos")}</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  )}
                </section>
              </>
            ) : (
              <AccountNote text={t("person.private")} />
            )}
          </>
        ) : !profile.loading && !profile.error ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t("person.notFound")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : null}
        {id !== user.id && (person || blocked) ? (
          <div className="border-t pt-6">
            <Button
              className="min-h-12"
              variant={blocked ? "outline" : "destructive"}
              disabled={busy}
              onClick={() =>
                blocked ? void act(() => unblock(id)) : setConfirm("block")
              }
            >
              {t(blocked ? "person.unblock" : "person.block")}
            </Button>
          </div>
        ) : null}
      </div>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirm === "block" ? "person.block" : "friends.remove")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                confirm === "block"
                  ? "person.blockConfirm"
                  : "friends.removeConfirm",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-12">
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-12"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                if (confirm === "block") void act(() => block(id));
                else if (row) void act(() => removeFriendship(row.id));
              }}
            >
              {t(confirm === "block" ? "person.block" : "friends.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SocialShell>
  );
}
