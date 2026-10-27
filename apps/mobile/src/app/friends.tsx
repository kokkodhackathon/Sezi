import { Username, type FriendshipRow } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Avatar } from '@/components/avatar';
import { EmptyInvite, FriendsArt } from '@/components/social-visuals';
import { Button, Card, Field, ListRow, Segmented, ToggleRow } from '@/components/ui';
import { CheckIcon, CloseIcon, EyeIcon, SearchIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, useAccount } from '@/lib/account';
import { useFriendActions, useFriendships } from '@/lib/friends';
import { useT } from '@/lib/i18n';
import { identityErrorKey, useIdentity } from '@/lib/identity';
import { searchPeople, usePerson } from '@/lib/people';

export default function FriendsScreen() {
  const { t: tr } = useT();
  const t = useSweetTheme();
  const { user } = useAccount();
  const { identity, save } = useIdentity();
  const friendships = useFriendships();
  const actions = useFriendActions();
  const [tab, setTab] = useState<'friends' | 'requests'>('friends');
  const [search, setSearch] = useState('');
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const parsed = Username.safeParse(search);
  const results = useQuery({
    queryKey: ['people', user?.id, search],
    enabled: !!user && parsed.success,
    queryFn: () => searchPeople(search),
  });
  const matches = results.data?.filter((person) => person.user_id !== user?.id) ?? [];
  const rows = friendships.data ?? [];
  const incoming = rows.filter((row) => row.status === 'pending' && row.addressee === user?.id);
  const outgoing = rows.filter((row) => row.status === 'pending' && row.requester === user?.id);
  const friends = rows.filter((row) => row.status === 'accepted');
  const perform = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await fn();
    } catch (error) {
      setFailure(tr(identityErrorKey(error)));
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <FormScreen>
        <EmptyInvite
          art={<FriendsArt />}
          text={tr('friends.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  const iconAction = (label: string, icon: (color: string) => ReactNode, onPress: () => void, primary = false) => (
    <SoftPressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy }}
      style={[styles.action, { backgroundColor: primary && !t.outlined ? t.primary.fill : t.soft }, outline(t)]}>
      {icon(primary && !t.outlined ? t.primary.ink : t.text)}
    </SoftPressable>
  );
  const requestRow = (row: FriendshipRow, received: boolean, first: boolean) => {
    const uid = received ? row.requester : row.addressee;
    return (
      <FriendRow
        key={row.id}
        uid={uid}
        first={first}
        trailing={(name) => (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {received
              ? iconAction(
                  tr('friends.acceptName', { name }),
                  (c) => <CheckIcon color={c} />,
                  () => void perform(() => actions.accept(row.id)),
                  true,
                )
              : null}
            {iconAction(
              tr(received ? 'friends.rejectName' : 'friends.withdrawName', { name }),
              (c) => <CloseIcon color={c} size={20} />,
              () => void perform(() => actions.removeFriendship(row.id)),
            )}
          </View>
        )}
      />
    );
  };
  return (
    <FormScreen>
      <View style={{ gap: space.sm }}>
        <Field
          label={tr('friends.search')}
          placeholder={tr('friends.searchPlaceholder')}
          help={tr('friends.searchHelp')}
          value={search}
          onChangeText={(value) => setSearch(value.replace(/^@/, '').toLowerCase().trim())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          icon={(c) => <SearchIcon color={c} size={20} />}
        />
        {identity && !identity.findable ? (
          <Card padded={false}>
            <ToggleRow
              first
              icon={(c) => <EyeIcon color={c} off />}
              title={tr('friends.notFindable')}
              value={identity.findable}
              onChange={(findable) => void perform(() => save({ findable }))}
            />
          </Card>
        ) : null}
      </View>
      {results.isFetching ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : null}
      {parsed.success && results.data ? (
        <Card padded={false}>
          {matches.length ? (
            matches.map((person, index) => <FriendRow key={person.user_id} uid={person.user_id} first={index === 0} />)
          ) : (
            <Text style={[type.body, { color: t.textMuted, padding: space.lg }]}>{tr('friends.noResults')}</Text>
          )}
        </Card>
      ) : null}
      <Segmented
        label={tr('friends.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: tr('friends.title') },
          { value: 'requests', label: incoming.length ? tr('friends.requests', { n: incoming.length }) : tr('friends.requestsTab') },
        ]}
      />
      {friendships.isLoading ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : tab === 'friends' ? (
        friends.length ? (
          <Card padded={false}>
            {friends.map((row, index) => (
              <FriendRow key={row.id} first={index === 0} uid={row.requester === user.id ? row.addressee : row.requester} />
            ))}
          </Card>
        ) : (
          <EmptyInvite art={<FriendsArt />} text={tr('friends.emptyInvite')} />
        )
      ) : incoming.length || outgoing.length ? (
        <Card padded={false}>
          {incoming.map((row, index) => requestRow(row, true, index === 0))}
          {outgoing.map((row, index) => requestRow(row, false, !incoming.length && index === 0))}
        </Card>
      ) : (
        <Text style={[type.body, { color: t.textMuted, textAlign: 'center' }]}>{tr('friends.noRequests')}</Text>
      )}
      <FormError
        text={
          failure ??
          (friendships.error || results.error ? tr(errorKey(friendships.error ?? results.error)) : undefined)
        }
      />
    </FormScreen>
  );
}

/**
 * Kişi satırı: avatar, ad, @ad. Eylem varsa (kabul/ret) satırın kendisi düğme olmaz: ad bölümü kişi
 * sayfasını açar, ikon düğmeleri yanında ayrı odaklanır (iç içe düğme ekran okuyucuda kaybolur).
 */
function FriendRow({ uid, first, trailing }: { uid: string; first?: boolean; trailing?: (name: string) => ReactNode }) {
  const { t: tr } = useT();
  const t = useSweetTheme();
  const person = usePerson(uid);
  const profile = person.data?.profile;
  const name = profile?.display_name ?? tr('person.notFound');
  const open = () => router.push({ pathname: '/person/[id]', params: { id: uid } });
  if (!trailing)
    return (
      <ListRow
        first={first}
        title={name}
        subtitle={profile?.username ? `@${profile.username}` : undefined}
        leading={<Avatar identity={profile ?? null} source={person.avatar} size={48} />}
        onPress={open}
      />
    );
  return (
    <View style={[styles.row, !first && { borderTopWidth: t.outlined ? 1 : StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
      <SoftPressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={[name, profile?.username ? `@${profile.username}` : null].filter(Boolean).join(', ')}
        style={styles.person}>
        <Avatar identity={profile ?? null} source={person.avatar} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
            {name}
          </Text>
          {profile?.username ? <Text style={[type.meta, { color: t.textMuted }]}>@{profile.username}</Text> : null}
        </View>
      </SoftPressable>
      {trailing(name)}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 72 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
});
