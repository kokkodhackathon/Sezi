import { Username, type FriendshipRow } from '@sezi/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Avatar } from '@/components/avatar';
import {
  Button,
  Card,
  EmptyState,
  Field,
  ListRow,
  Note,
  SectionTitle,
  Segmented,
  ToggleRow,
} from '@/components/ui';
import { space } from '@/design/type';
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
        <EmptyState
          title={tr('friends.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  const requestRow = (row: FriendshipRow, received: boolean) => (
    <View key={row.id} style={{ gap: space.sm }}>
      <FriendRow uid={received ? row.requester : row.addressee} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {received ? (
          <Button
            compact
            label={tr('friends.accept')}
            disabled={busy}
            onPress={() => void perform(() => actions.accept(row.id))}
          />
        ) : null}
        <Button
          compact
          variant="outline"
          label={tr(received ? 'friends.reject' : 'friends.withdraw')}
          disabled={busy}
          onPress={() => void perform(() => actions.removeFriendship(row.id))}
        />
      </View>
    </View>
  );
  return (
    <FormScreen>
      {identity && !identity.findable ? (
        <Card>
          <Note text={tr('friends.findableNote')} />
          <ToggleRow
            first
            title={tr('privacy.findable')}
            value={identity.findable}
            onChange={(findable) => void perform(() => save({ findable }))}
          />
        </Card>
      ) : null}
      <Field
        label={tr('friends.search')}
        help={tr('friends.searchHelp')}
        value={search}
        onChangeText={(value) => setSearch(value.toLowerCase().trim())}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
      />
      {results.isFetching ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : null}
      {parsed.success && results.data ? (
        <Card padded={false}>
          {matches.length ? (
            matches.map((person, index) => (
              <ListRow
                key={person.user_id}
                first={index === 0}
                title={person.display_name}
                subtitle={person.username ? `@${person.username}` : undefined}
                onPress={() => router.push({ pathname: '/person/[id]', params: { id: person.user_id } })}
              />
            ))
          ) : (
            <EmptyState title={tr('friends.noResults')} />
          )}
        </Card>
      ) : null}
      <Segmented
        label={tr('friends.title')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'friends', label: tr('friends.title') },
          { value: 'requests', label: tr('friends.requests', { n: incoming.length }) },
        ]}
      />
      {friendships.isLoading ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : tab === 'friends' ? (
        friends.length ? (
          <Card padded={false}>
            {friends.map((row) => (
              <FriendRow key={row.id} uid={row.requester === user.id ? row.addressee : row.requester} />
            ))}
          </Card>
        ) : (
          <EmptyState title={tr('friends.empty')} />
        )
      ) : (
        <>
          {!incoming.length && !outgoing.length ? <EmptyState title={tr('friends.noRequests')} /> : null}
          {incoming.length ? (
            <>
              <SectionTitle title={tr('friends.incoming')} />
              <Card>{incoming.map((row) => requestRow(row, true))}</Card>
            </>
          ) : null}
          {outgoing.length ? (
            <>
              <SectionTitle title={tr('friends.outgoing')} />
              <Card>{outgoing.map((row) => requestRow(row, false))}</Card>
            </>
          ) : null}
        </>
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

function FriendRow({ uid }: { uid: string }) {
  const { t: tr } = useT();
  const person = usePerson(uid);
  const profile = person.data?.profile;
  return (
    <ListRow
      first
      title={profile?.display_name ?? tr('person.notFound')}
      subtitle={profile?.username ? `@${profile.username}` : undefined}
      leading={<Avatar identity={profile ?? null} source={person.avatar} size={48} />}
      onPress={() => router.push({ pathname: '/person/[id]', params: { id: uid } })}
    />
  );
}
