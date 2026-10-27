"use client";

import { Username, friendState, type ProfileCard } from "@sezi/shared";
import { Check, Clock, EyeOff, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Avatar } from "@/components/account/avatar";
import { FormError } from "@/components/account/form-error";
import { SocialShell, useSocialAccount } from "@/components/account/social-shell";
import { EmptyInvite, FriendsArt } from "@/components/account/social-visuals";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { href } from "@/lib/i18n";
import { useT } from "@/lib/i18n-client";
import { useIdentity } from "@/lib/identity";
import {
  accept,
  avatarUrl,
  getFriendships,
  getPerson,
  removeFriendship,
  searchPeople,
  sendRequest,
} from "@/lib/social";
import { useAsync } from "@/lib/use-async";

export default function FriendsPage() {
  const { ready, user } = useSocialAccount();
  const { t, lang } = useT();
  const { identity, save } = useIdentity();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const list = useAsync(async () => {
    if (!ready || !user) return null;
    const rows = await getFriendships();
    const people = await Promise.all(
      rows.map(async (row) => {
        const id = row.requester === user.id ? row.addressee : row.requester;
        const person = await getPerson(id);
        return {
          row,
          id,
          person,
          avatar: await avatarUrl(person?.avatar_path ?? null),
        };
      }),
    );
    return { rows, people };
  }, [ready, user?.id]);
  const results = useAsync(async () => {
    if (!ready || !user || !Username.safeParse(search).success) return [];
    const people = (await searchPeople(search)).filter(
      (person) => person.user_id !== user.id,
    );
    return Promise.all(
      people.map(async (person) => ({
        person,
        avatar: await avatarUrl(person.avatar_path),
      })),
    );
  }, [ready, user?.id, search]);
  const act = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await action();
      list.reload();
      results.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  if (!ready || !user) return null;
  const renderPerson = (
    person: ProfileCard | null,
    id: string,
    avatar?: string | null,
  ) => (
    <Link
      href={href(lang, `/kisi/${id}`)}
      className="flex min-h-12 min-w-0 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Avatar identity={person} src={avatar} size={44} />
      <span className="grid min-w-0">
        <span className="truncate font-semibold">
          {person?.display_name ?? t("person.notFound")}
        </span>
        {person?.username ? (
          <span className="truncate text-sm text-muted-foreground">
            @{person.username}
          </span>
        ) : null}
      </span>
    </Link>
  );
  const incomingCount = list.data?.rows.filter((row) => row.status === "pending" && row.addressee === user.id).length ?? 0;
  const iconButton = (label: string, icon: ReactNode, onClick: () => void, primary = false) => (
    <Button
      size="icon"
      variant={primary ? "default" : "secondary"}
      className="size-12 rounded-full"
      aria-label={label}
      disabled={busy}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
  const renderList = (kind: "friends" | "requests") => {
    const items =
      list.data?.people.filter(({ row }) =>
        kind === "friends" ? row.status === "accepted" : row.status === "pending",
      ) ?? [];
    if (!items.length)
      return kind === "friends" ? (
        <EmptyInvite art={<FriendsArt />} text={t("friends.emptyInvite")} />
      ) : (
        <p className="py-6 text-center text-muted-foreground">{t("friends.noRequests")}</p>
      );
    return (
      <ul className="divide-y rounded-xl border bg-card">
        {items.map(({ row, person, id, avatar }) => {
          const name = person?.display_name ?? t("person.notFound");
          const incoming = row.status === "pending" && row.addressee === user.id;
          return (
            <li key={row.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">{renderPerson(person, id, avatar)}</div>
              <div className="flex gap-2">
                {incoming
                  ? iconButton(t("friends.acceptName", { name }), <Check aria-hidden />, () => void act(() => accept(row.id)), true)
                  : null}
                {iconButton(
                  t(kind === "friends" ? "friends.remove" : incoming ? "friends.rejectName" : "friends.withdrawName", { name }),
                  kind === "friends" ? <UserMinus aria-hidden /> : <X aria-hidden />,
                  () => (kind === "friends" ? setConfirm(row.id) : void act(() => removeFriendship(row.id))),
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };
  return (
    <SocialShell title="friends.title" loading={list.loading} error={list.error ?? results.error}>
      <div className="flex flex-col gap-6">
        <FormError text={failed ? t("friends.error") : null} />
        <section aria-labelledby="friend-search" className="grid gap-3">
          <h2 id="friend-search" className="sr-only">
            {t("friends.search")}
          </h2>
          <form
            role="search"
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const next = query.trim().replace(/^@/, "");
              if (Username.safeParse(next).success) setSearch(next);
            }}
          >
            <label htmlFor="friend-query" className="sr-only">
              {t("friends.search")}
            </label>
            <div className="relative flex-1">
              <Search aria-hidden className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="friend-query"
                className="h-12 rounded-xl border-0 bg-muted pl-12"
                placeholder={t("friends.searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                aria-describedby="friend-query-help"
              />
            </div>
            <Button
              type="submit"
              className="min-h-12"
              disabled={!Username.safeParse(query.trim().replace(/^@/, "")).success || results.loading}
            >
              {t("friends.searchButton")}
            </Button>
          </form>
          <p id="friend-query-help" className="text-sm text-muted-foreground">
            {t("friends.searchHelp")}
          </p>
          {identity && !identity.findable ? (
            <div className="flex min-h-12 items-center gap-3 rounded-xl bg-muted px-4 py-2 contrast:outline-2 contrast:outline-border">
              <EyeOff aria-hidden className="size-5 text-muted-foreground" />
              <label htmlFor="friends-findable" className="flex-1 cursor-pointer font-semibold">
                {t("friends.notFindable")}
              </label>
              <Switch
                id="friends-findable"
                checked={identity.findable}
                disabled={busy}
                onCheckedChange={(findable) => void act(() => save({ findable }))}
              />
            </div>
          ) : null}
          <div aria-live="polite">
            {search && !results.loading && results.data?.length === 0 ? (
              <p className="py-3 text-muted-foreground">{t("friends.noResults")}</p>
            ) : null}
          </div>
          {results.data?.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {results.data.map(({ person, avatar }) => {
                const state = friendState(list.data?.rows ?? [], user.id, person.user_id);
                return (
                  <li key={person.user_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">{renderPerson(person, person.user_id, avatar)}</div>
                    {state === "none" ? (
                      iconButton(t("friends.addName", { name: person.display_name }), <UserPlus aria-hidden />, () =>
                        void act(() => sendRequest(person.user_id)), true)
                    ) : (
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {state === "friends" ? <Users aria-hidden className="size-4" /> : <Clock aria-hidden className="size-4" />}
                        {t(state === "friends" ? "friends.connected" : state === "incoming" ? "friends.requestsTab" : "friends.sentShort")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </section>
        <Tabs defaultValue="friends">
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="friends" className="min-h-12 px-4">
              {t("friends.title")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="min-h-12 gap-2 px-4">
              {t("friends.requestsTab")}
              {incomingCount ? (
                <span
                  className="grid h-6 min-w-6 place-items-center rounded-full bg-link px-1.5 text-xs font-bold text-background"
                  aria-label={t("friends.incomingCount", { n: incomingCount })}
                >
                  {incomingCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="friends" className="pt-4">
            {renderList("friends")}
          </TabsContent>
          <TabsContent value="requests" className="pt-4">
            {renderList("requests")}
          </TabsContent>
        </Tabs>
      </div>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("friends.remove")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("friends.removeConfirm")}
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
                if (confirm) void act(() => removeFriendship(confirm));
              }}
            >
              {t("friends.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SocialShell>
  );
}
