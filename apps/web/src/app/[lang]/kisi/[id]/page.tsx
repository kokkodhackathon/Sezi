"use client";

import { achievements, friendState, passportStats } from "@sezi/shared";
import { Award, Ban, Check, Clock, Map as MapIcon, Stamp as StampIcon, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Avatar } from "@/components/account/avatar";
import { FormError } from "@/components/account/form-error";
import { SocialShell, useSocialAccount } from "@/components/account/social-shell";
import { AchievementGrid, EmptyInvite, LockedArt, StampGrid, StatStrip } from "@/components/account/social-visuals";
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
import { href } from "@/lib/i18n";
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
  const cities = content ? content.stats.cities.filter((city) => city.visited > 0).length : 0;
  return (
    <SocialShell title="person.title" loading={profile.loading} error={profile.error}>
      <div className="flex flex-col gap-8">
        <FormError text={failed ? t("friends.error") : null} />
        {person ? (
          <>
            <header className="grid justify-items-center gap-2 text-center">
              <Avatar identity={person} src={data?.avatar} size={96} />
              <h2 className="break-words font-heading text-2xl font-extrabold">{person.display_name}</h2>
              {person.username ? <p className="break-all text-muted-foreground">@{person.username}</p> : null}
            </header>
            {id !== user.id && !blocked ? (
              <div className="flex flex-wrap justify-center gap-2">
                {state === "none" ? (
                  <Button className="min-h-12 min-w-48" disabled={busy} onClick={() => void act(() => sendRequest(id))}>
                    <UserPlus aria-hidden />
                    {t("friends.add")}
                  </Button>
                ) : null}
                {state === "outgoing" && row ? (
                  <Button
                    className="min-h-12 min-w-48"
                    variant="secondary"
                    disabled={busy}
                    aria-label={`${t("friends.sentShort")}. ${t("friends.withdraw")}`}
                    onClick={() => void act(() => removeFriendship(row.id))}
                  >
                    <Clock aria-hidden />
                    {t("friends.sentShort")}
                  </Button>
                ) : null}
                {state === "incoming" && row ? (
                  <>
                    <Button className="min-h-12" disabled={busy} onClick={() => void act(() => accept(row.id))}>
                      <Check aria-hidden />
                      {t("friends.accept")}
                    </Button>
                    <Button className="min-h-12" variant="outline" disabled={busy} onClick={() => void act(() => removeFriendship(row.id))}>
                      <X aria-hidden />
                      {t("friends.reject")}
                    </Button>
                  </>
                ) : null}
                {state === "friends" ? (
                  <Button
                    className="min-h-12 min-w-48"
                    variant="secondary"
                    disabled={busy}
                    aria-label={`${t("friends.connected")}. ${t("friends.remove")}`}
                    onClick={() => setConfirm("remove")}
                  >
                    <Users aria-hidden />
                    {t("friends.connected")}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {content ? (
              <>
                <StatStrip
                  items={[
                    { icon: StampIcon, value: String(content.stats.stamps), label: t("stat.stamps") },
                    { icon: MapIcon, value: String(cities), label: t("stat.cities") },
                    { icon: Award, value: String(content.achievements.length), label: t("stat.badges") },
                  ]}
                />
                {content.stats.stamps ? (
                  <section aria-labelledby="person-stamps" className="grid gap-4">
                    <h2 id="person-stamps" className="font-heading text-lg font-bold">
                      {t("passport.recent")}
                    </h2>
                    <StampGrid visits={content.visits} works={new Map(content.works.map((work) => [work.slug, work]))} limit={12} />
                  </section>
                ) : null}
                {content.achievements.length ? (
                  <section aria-labelledby="person-achievements" className="grid gap-4">
                    <h2 id="person-achievements" className="font-heading text-lg font-bold">
                      {t("ach.title")}
                    </h2>
                    <AchievementGrid list={content.achievements} />
                  </section>
                ) : null}
                {content.photos.length ? (
                  <section aria-labelledby="person-photos" className="grid gap-4">
                    <h2 id="person-photos" className="font-heading text-lg font-bold">
                      {t("person.photos")}
                    </h2>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {content.photos.map((photo) => (
                        <li key={photo.id}>
                          <Link
                            href={href(lang, `/hesap/fotograflar/${photo.id}`)}
                            className="block overflow-hidden rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring"
                          >
                            {content.urls[photo.thumb_path] ? (
                              <img
                                src={content.urls[photo.thumb_path]}
                                alt={photo.alt_text}
                                width={photo.width}
                                height={photo.height}
                                className="aspect-square w-full object-cover"
                              />
                            ) : (
                              <span className="grid aspect-square place-items-center bg-muted p-3 text-sm">{photo.alt_text}</span>
                            )}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            ) : (
              <EmptyInvite art={<LockedArt />} text={t("person.privateShort")} />
            )}
          </>
        ) : !profile.loading && !profile.error ? (
          <EmptyInvite art={<LockedArt />} text={t("person.notFound")} />
        ) : null}
        {id !== user.id && (person || blocked) ? (
          <div className="flex justify-center border-t pt-6">
            <Button
              className="min-h-12"
              variant={blocked ? "outline" : "ghost"}
              disabled={busy}
              onClick={() => (blocked ? void act(() => unblock(id)) : setConfirm("block"))}
            >
              <Ban aria-hidden />
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
