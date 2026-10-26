import { achievements, friendState, hasLocation, loc, passportStats } from '@sezi/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { AchievementBadge } from '@/components/achievement-badge';
import { Avatar } from '@/components/avatar';
import { Badge, Button, Card, EmptyState, ListRow, Note, SectionTitle } from '@/components/ui';
import { SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
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
  const { t: tr, lang } = useT();
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
  return (
    <FormScreen>
      <View style={styles.identity}>
        <Avatar identity={profile} source={person.avatar} size={88} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Text accessibilityRole="header" style={[type.title, { color: t.text }]}>
            {profile.display_name}
          </Text>
          {profile.username ? (
            <Text style={[type.body, { color: t.textMuted }]}>{`@${profile.username}`}</Text>
          ) : null}
        </View>
      </View>
      {uid !== user.id ? (
        <View style={{ gap: space.sm }}>
          {blocked ? (
            <Button
              variant="outline"
              label={tr('person.unblock')}
              disabled={!socialReady}
              onPress={() => void perform(() => actions.unblock(uid))}
            />
          ) : state === 'friends' ? (
            <>
              <Badge label={tr('friends.connected')} tone="primary" />
              <Button
                variant="outline"
                label={tr('friends.remove')}
                disabled={!socialReady}
                onPress={confirmRemove}
              />
            </>
          ) : state === 'incoming' ? (
            <>
              <Button
                label={tr('friends.accept')}
                disabled={!socialReady}
                onPress={() => {
                  if (relationship) void perform(() => actions.accept(relationship.id));
                }}
              />
              <Button
                variant="outline"
                label={tr('friends.reject')}
                disabled={!socialReady}
                onPress={() => {
                  if (relationship) void perform(() => actions.removeFriendship(relationship.id));
                }}
              />
            </>
          ) : state === 'outgoing' ? (
            <Button
              variant="outline"
              label={tr('friends.sent')}
              disabled={!socialReady}
              onPress={() => {
                if (relationship) void perform(() => actions.removeFriendship(relationship.id));
              }}
            />
          ) : (
            <Button
              label={tr('friends.add')}
              disabled={!socialReady}
              onPress={() => void perform(() => actions.sendRequest(uid))}
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
          <SectionTitle title={tr('passport.title')} />
          <Card>
            <Text style={[type.title, { color: t.text }]}>{tr('passport.stamps', { n: stats.stamps })}</Text>
            <Text style={[type.body, { color: t.textMuted }]}>
              {tr('passport.summary', {
                cities: stats.cities.filter((city) => city.visited > 0).length,
                km: (stats.distanceM / 1000).toFixed(1),
              })}
            </Text>
          </Card>
          <SectionTitle title={tr('ach.title')} />
          {earned.length ? (
            earned.map((achievement) => <AchievementBadge key={achievement.id} achievement={achievement} />)
          ) : (
            <Note text={tr('person.emptyAchievements')} />
          )}
          <SectionTitle title={tr('person.stamps')} />
          {visits.isLoading ? (
            <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
          ) : visits.data?.length ? (
            <Card padded={false}>
              {visits.data.slice(0, 10).map((visit, index) => {
                const work = works.find((entry) => entry.slug === visit.work_slug);
                return (
                  <ListRow
                    key={visit.work_slug}
                    first={index === 0}
                    title={work ? loc(work.name, lang) : visit.work_slug}
                    subtitle={`${new Date(visit.first_at).toLocaleDateString(lang)} · ${tr(visit.method === 'checkin' ? 'passport.byCheckin' : 'passport.byRoute')}`}
                    onPress={() =>
                      router.push({ pathname: '/work/[slug]', params: { slug: visit.work_slug } })
                    }
                  />
                );
              })}
            </Card>
          ) : (
            <Note text={tr('person.emptyStamps')} />
          )}
          <FormError
            text={visits.error || catalogue.error ? tr(errorKey(visits.error ?? catalogue.error)) : undefined}
          />
          <SectionTitle title={tr('person.photos')} />
          {photos.isLoading ? (
            <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
          ) : photos.data?.length ? (
            <View style={styles.grid}>
              {photos.data.map((photo) => (
                <SoftPressable
                  key={photo.id}
                  accessibilityRole="button"
                  accessibilityLabel={photo.alt_text}
                  onPress={() => router.push({ pathname: '/photos/[id]', params: { id: photo.id } })}
                  style={[styles.photo, { backgroundColor: t.soft, borderColor: t.border }]}>
                  <Image
                    source={urls.data?.[photo.thumb_path]}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    accessible={false}
                  />
                </SoftPressable>
              ))}
            </View>
          ) : (
            <Note text={tr('person.emptyPhotos')} />
          )}
          <FormError
            text={photos.error || urls.error ? tr(errorKey(photos.error ?? urls.error)) : undefined}
          />
        </>
      ) : (
        <Note text={tr('person.private')} />
      )}
      {uid !== user.id ? (
        <Card padded={false}>
          <ListRow
            first
            danger={!blocked}
            title={tr(blocked ? 'person.unblock' : 'person.block')}
            onPress={
              socialReady
                ? blocked
                  ? () => void perform(() => actions.unblock(uid))
                  : confirmBlock
                : undefined
            }
          />
        </Card>
      ) : null}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  photo: {
    width: '31%',
    aspectRatio: 1,
    minWidth: 48,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
