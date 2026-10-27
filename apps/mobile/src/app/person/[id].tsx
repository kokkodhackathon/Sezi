import { achievements, friendState, hasLocation, passportStats } from '@sezi/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Avatar } from '@/components/avatar';
import { AchievementGrid, PhotoGrid, StampGrid } from '@/components/social-grids';
import { EmptyInvite, LockedArt, StatStrip } from '@/components/social-visuals';
import { Button, EmptyState, SectionTitle } from '@/components/ui';
import { AwardIcon, BanIcon, CheckIcon, ClockIcon, CloseIcon, MapAreaIcon, StampIcon, UserPlusIcon, UsersIcon } from '@/design/icons';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, useAccount } from '@/lib/account';
import { useBlocks, useFriendActions, useFriendships } from '@/lib/friends';
import { useT } from '@/lib/i18n';
import { usePerson, usePersonVisits } from '@/lib/people';
import { usePersonPhotos, usePhotoUrls } from '@/lib/photos';
import { useTours } from '@/lib/tours';
import { useWorks } from '@/lib/works';

export default function PersonScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const uid = typeof params.id === 'string' ? params.id : '';
  const { t: tr } = useT();
  const t = useSweetTheme();
  const { user } = useAccount();
  const person = usePerson(uid);
  const friendships = useFriendships();
  const blocks = useBlocks();
  const actions = useFriendActions();
  const visible = !!person.data?.contributions;
  const visits = usePersonVisits(uid, visible);
  const photos = usePersonPhotos(uid);
  const urls = usePhotoUrls((photos.data ?? []).map((photo) => photo.thumb_path));
  const catalogue = useWorks();
  const tourList = useTours();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string>();
  const works = useMemo(
    () =>
      (catalogue.data ?? []).map((work) => ({
        slug: work.slug,
        name: work.name,
        type_slug: work.type_slug,
        city_slug: work.city_slug,
        complex_slug: work.complex_slug,
        complex_name: work.complex_name,
        located: hasLocation(work),
      })),
    [catalogue.data],
  );
  const tours = useMemo(
    () => tourList.map((tour) => ({ slug: tour.slug, title: tour.title, stops: tour.stops })),
    [tourList],
  );
  const stats = useMemo(() => passportStats(visits.data ?? [], works, tours), [visits.data, works, tours]);
  const earned = useMemo(
    () =>
      person.data?.contributions
        ? achievements({
            visits: visits.data ?? [],
            works,
            tours,
            contributions: person.data.contributions,
          }).filter((achievement) => achievement.level >= 1)
        : [],
    [person.data, visits.data, works, tours],
  );
  const state = friendState(friendships.data ?? [], user?.id ?? '', uid);
  const relationship = friendships.data?.find(
    (row) =>
      (row.requester === uid && row.addressee === user?.id) ||
      (row.requester === user?.id && row.addressee === uid),
  );
  const blocked = blocks.data?.some((row) => row.blocked === uid) ?? false;
  const perform = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await fn();
    } catch (error) {
      setFailure(tr(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };
  const confirmRemove = () =>
    Alert.alert(tr('friends.remove'), tr('friends.removeConfirm'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('friends.remove'),
        style: 'destructive',
        onPress: () => {
          if (relationship) void perform(() => actions.removeFriendship(relationship.id));
        },
      },
    ]);
  const confirmBlock = () =>
    Alert.alert(tr('person.block'), tr('person.blockConfirm'), [
      { text: tr('common.cancel'), style: 'cancel' },
      {
        text: tr('person.block'),
        style: 'destructive',
        onPress: () => void perform(() => actions.block(uid)),
      },
    ]);
  if (!user)
    return (
      <FormScreen>
        <EmptyState
          title={tr('friends.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  if (person.isLoading)
    return (
      <FormScreen>
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      </FormScreen>
    );
  if (person.error)
    return (
      <FormScreen>
        <FormError text={tr(errorKey(person.error))} />
        <Button label={tr('common.retry')} onPress={() => void person.refetch()} />
      </FormScreen>
    );
  if (!person.data)
    return (
      <FormScreen>
        <EmptyState title={tr('person.notFound')} />
      </FormScreen>
    );
  const profile = person.data.profile;
  const socialReady =
    !busy && !friendships.isLoading && !blocks.isLoading && !friendships.error && !blocks.error;
  const bySlug = new Map((catalogue.data ?? []).map((work) => [work.slug, work]));
  const cities = stats.cities.filter((city) => city.visited > 0).length;
  const withRelationship = (fn: (id: string) => Promise<unknown>) => () => {
    if (relationship) void perform(() => fn(relationship.id));
  };
  return (
    <FormScreen>
      {/* Kimlik: ortalı avatar, ad, @ad; altında tek ana eylem. */}
      <View style={styles.identity}>
        <Avatar identity={profile} source={person.avatar} size={88} />
        <Text accessibilityRole="header" style={[type.title, { color: t.text, textAlign: 'center' }]}>
          {profile.display_name}
        </Text>
        {profile.username ? <Text style={[type.meta, { color: t.textMuted }]}>{`@${profile.username}`}</Text> : null}
      </View>
      {uid !== user.id && !blocked ? (
        <View style={styles.actions}>
          {state === 'friends' ? (
            <Button
              variant="secondary"
              icon={(c) => <UsersIcon color={c} />}
              label={tr('friends.connected')}
              hint={tr('friends.remove')}
              disabled={!socialReady}
              onPress={confirmRemove}
              style={{ flex: 1 }}
            />
          ) : state === 'incoming' ? (
            <>
              <Button
                icon={(c) => <CheckIcon color={c} />}
                label={tr('friends.accept')}
                disabled={!socialReady}
                onPress={withRelationship(actions.accept)}
                style={{ flex: 1 }}
              />
              <Button
                variant="outline"
                icon={(c) => <CloseIcon color={c} size={20} />}
                label={tr('friends.reject')}
                disabled={!socialReady}
                onPress={withRelationship(actions.removeFriendship)}
                style={{ flex: 1 }}
              />
            </>
          ) : state === 'outgoing' ? (
            <Button
              variant="secondary"
              icon={(c) => <ClockIcon color={c} />}
              label={tr('friends.sentShort')}
              hint={tr('friends.withdraw')}
              disabled={!socialReady}
              onPress={withRelationship(actions.removeFriendship)}
              style={{ flex: 1 }}
            />
          ) : (
            <Button
              icon={(c) => <UserPlusIcon color={c} />}
              label={tr('friends.add')}
              disabled={!socialReady}
              onPress={() => void perform(() => actions.sendRequest(uid))}
              style={{ flex: 1 }}
            />
          )}
        </View>
      ) : null}
      <FormError
        text={
          failure ??
          (friendships.error || blocks.error ? tr(errorKey(friendships.error ?? blocks.error)) : undefined)
        }
      />
      {visible ? (
        <>
          <StatStrip
            items={[
              { icon: StampIcon, value: String(stats.stamps), label: tr('stat.stamps') },
              { icon: MapAreaIcon, value: String(cities), label: tr('stat.cities') },
              { icon: AwardIcon, value: String(earned.length), label: tr('stat.badges') },
            ]}
          />
          {visits.isLoading ? (
            <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
          ) : visits.data?.length ? (
            <View style={{ gap: space.lg }}>
              <SectionTitle title={tr('passport.recent')} />
              <StampGrid visits={visits.data} works={bySlug} limit={9} />
            </View>
          ) : null}
          {earned.length ? (
            <View style={{ gap: space.lg }}>
              <SectionTitle title={tr('ach.title')} />
              <AchievementGrid list={earned} />
            </View>
          ) : null}
          <FormError
            text={visits.error || catalogue.error ? tr(errorKey(visits.error ?? catalogue.error)) : undefined}
          />
          {photos.data?.length ? (
            <View style={{ gap: space.lg }}>
              <SectionTitle title={tr('person.photos')} />
              <PhotoGrid
                photos={photos.data}
                urls={urls.data}
                showStatus={false}
                onOpen={(photo) => router.push({ pathname: '/photos/[id]', params: { id: photo.id } })}
              />
            </View>
          ) : null}
          <FormError
            text={photos.error || urls.error ? tr(errorKey(photos.error ?? urls.error)) : undefined}
          />
        </>
      ) : (
        <EmptyInvite art={<LockedArt />} text={tr('person.privateShort')} />
      )}
      {uid !== user.id ? (
        <View style={{ alignItems: 'center', paddingTop: space.lg }}>
          <Button
            variant={blocked ? 'outline' : 'ghost'}
            compact
            icon={(c) => <BanIcon color={c} size={18} />}
            label={tr(blocked ? 'person.unblock' : 'person.block')}
            disabled={!socialReady}
            onPress={blocked ? () => void perform(() => actions.unblock(uid)) : confirmBlock}
          />
        </View>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
