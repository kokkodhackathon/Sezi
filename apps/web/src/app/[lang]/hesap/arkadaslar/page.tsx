"use client";

import { Username, friendState, type ProfileCard } from "@sezi/shared";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/components/account/avatar";
import {
  AccountField,
  AccountNote,
  FormError,
} from "@/components/account/form-error";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
  const renderList = (kind: "friends" | "incoming" | "outgoing") => {
    const items =
      list.data?.people.filter(({ row }) =>
        kind === "friends"
          ? row.status === "accepted"
          : row.status === "pending" &&
            (kind === "incoming"
              ? row.addressee === user.id
              : row.requester === user.id),
      ) ?? [];
    return items.length ? (
      <ul className="divide-y">
        {items.map(({ row, person, id, avatar }) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            {renderPerson(person, id, avatar)}
            <div className="flex flex-wrap gap-2">
              {kind === "incoming" ? (
                <Button
                  className="min-h-12"
                  disabled={busy}
                  onClick={() => void act(() => accept(row.id))}
                >
                  {t("friends.accept")}
                </Button>
              ) : null}
              <Button
                className="min-h-12"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  kind === "friends"
                    ? setConfirm(row.id)
                    : void act(() => removeFriendship(row.id))
                }
              >
                {t(
                  kind === "friends"
                    ? "friends.remove"
                    : kind === "incoming"
                      ? "friends.reject"
                      : "friends.withdraw",
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>
            {t(kind === "friends" ? "friends.empty" : "friends.noRequests")}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  };
  return (
    <SocialShell
      title="friends.title"
      loading={list.loading}
      error={list.error ?? results.error}
    >
      <div className="flex flex-col gap-8">
        <FormError text={failed ? t("friends.error") : null} />
        {!identity?.findable ? (
          <AccountNote text={t("friends.findableNote")} />
        ) : null}
        <Field
          orientation="horizontal"
          data-disabled={busy || !identity}
          className="min-h-12"
        >
          <FieldContent>
            <FieldLabel htmlFor="friends-findable" className="min-h-12">
              {t("privacy.findable")}
            </FieldLabel>
            <FieldDescription>{t("privacy.findableHelp")}</FieldDescription>
          </FieldContent>
          <Switch
            id="friends-findable"
            checked={identity?.findable ?? false}
            disabled={busy || !identity}
            onCheckedChange={(findable) => void act(() => save({ findable }))}
          />
        </Field>
        <section aria-labelledby="friend-search" className="border-t pt-6">
          <h2 id="friend-search" className="mb-4 text-xl font-bold">
            {t("friends.search")}
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (Username.safeParse(query.trim()).success)
                setSearch(query.trim());
            }}
          >
            <FieldGroup>
              <AccountField
                className="[&_input]:min-h-12"
                label={t("friends.searchLabel")}
                help={t("friends.searchHelp")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                minLength={3}
              />
              <Button
                className="min-h-12"
                type="submit"
                disabled={
                  !Username.safeParse(query.trim()).success || results.loading
                }
              >
                {t("friends.search")}
              </Button>
            </FieldGroup>
          </form>
          <div aria-live="polite">
            {search && !results.loading && results.data?.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{t("friends.noResults")}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
          <ul className="divide-y">
            {results.data?.map(({ person, avatar }) => {
              const state = friendState(
                list.data?.rows ?? [],
                user.id,
                person.user_id,
              );
              return (
                <li
                  key={person.user_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  {renderPerson(person, person.user_id, avatar)}
                  {state === "none" ? (
                    <Button
                      className="min-h-12"
                      disabled={busy}
                      onClick={() =>
                        void act(() => sendRequest(person.user_id))
                      }
                    >
                      {t("friends.add")}
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t(
                        state === "friends"
                          ? "friends.connected"
                          : state === "incoming"
                            ? "friends.incoming"
                            : "friends.outgoing",
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <Tabs defaultValue="friends">
          <TabsList className="h-auto max-w-full flex-wrap">
            <TabsTrigger value="friends" className="min-h-12">
              {t("friends.title")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="min-h-12">
              {t("friends.requests", {
                n:
                  list.data?.rows.filter(
                    (row) =>
                      row.status === "pending" && row.addressee === user.id,
                  ).length ?? 0,
              })}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="friends">{renderList("friends")}</TabsContent>
          <TabsContent value="requests" className="flex flex-col gap-6">
            <section aria-labelledby="incoming-title">
              <h2 id="incoming-title" className="text-lg font-bold">
                {t("friends.incoming")}
              </h2>
              {renderList("incoming")}
            </section>
            <section aria-labelledby="outgoing-title">
              <h2 id="outgoing-title" className="text-lg font-bold">
                {t("friends.outgoing")}
              </h2>
              {renderList("outgoing")}
            </section>
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
