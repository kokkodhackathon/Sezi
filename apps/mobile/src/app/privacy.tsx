import { type IdentityPatch } from '@sezi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Avatar } from '@/components/avatar';
import { EmptyInvite, LockedArt, VisibilityChoice } from '@/components/social-visuals';
import { Button, Card, SectionTitle, ToggleRow } from '@/components/ui';
import { BanIcon, SearchIcon, ShieldIcon } from '@/design/icons';
import { outline, SoftPressable } from '@/design/sweet/components';
import { space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { errorKey, useAccount } from '@/lib/account';
import { useBlocks, useFriendActions } from '@/lib/friends';
import { useT } from '@/lib/i18n';
import { identityErrorKey, useIdentity } from '@/lib/identity';
import { usePerson } from '@/lib/people';

export default function PrivacyScreen() {
  const { t: tr } = useT();
  const t = useSweetTheme();
  const { user } = useAccount();
  const { identity, save } = useIdentity();
  const blocks = useBlocks();
  const { unblock } = useFriendActions();
  const [failure, setFailure] = useState<string>();
  const [busy, setBusy] = useState(false);
  const update = async (patch: IdentityPatch) => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await save(patch);
    } catch (error) {
      setFailure(tr(identityErrorKey(error)));
    } finally {
      setBusy(false);
    }
  };
  const removeBlock = async (uid: string) => {
    if (busy) return;
    setBusy(true);
    setFailure(undefined);
    try {
      await unblock(uid);
    } catch (error) {
      setFailure(tr(errorKey(error)));
    } finally {
      setBusy(false);
    }
  };
  const labels = { private: tr('photos.vis.private'), friends: tr('photos.vis.friends'), public: tr('photos.vis.public') };
  if (!user)
    return (
      <FormScreen>
        <EmptyInvite
          art={<LockedArt />}
          text={tr('friends.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  if (!identity)
    return (
      <FormScreen>
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      </FormScreen>
    );
  return (
    <FormScreen>
      {/* collapsable={false}: pointerEvents değişimi Fabric'te düzleştirme çökmesine yol açmasın (photo-fields.tsx). */}
      <View
        collapsable={false}
        style={{ gap: space.xl }}
        pointerEvents={busy ? 'none' : 'auto'}
        accessibilityState={{ busy }}>
        <View style={{ gap: space.md }}>
          <SectionTitle title={tr('privacy.who')} />
          <VisibilityChoice
            layout="stack"
            label={tr('privacy.who')}
            value={identity.visibility}
            labels={labels}
            onChange={(visibility) => void update({ visibility })}
          />
          <Text style={[type.meta, { color: t.textMuted }]} accessibilityLiveRegion="polite">
            {tr(`privacy.vis.${identity.visibility}`)}
          </Text>
        </View>
        <Card padded={false}>
          <ToggleRow
            first
            icon={(c) => <SearchIcon color={c} size={22} />}
            title={tr('privacy.findable')}
            subtitle={tr('privacy.findableHelp')}
            value={identity.findable}
            onChange={(findable) => void update({ findable })}
          />
        </Card>
        <View style={{ gap: space.md }}>
          <SectionTitle title={tr('privacy.photoDefault')} />
          <VisibilityChoice
            label={tr('privacy.photoDefault')}
            value={identity.photo_default}
            labels={labels}
            onChange={(photo_default) => void update({ photo_default })}
          />
        </View>
      </View>
      <View style={{ gap: space.md }}>
        <SectionTitle title={tr('privacy.blocked')} />
        {blocks.isLoading ? (
          <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
        ) : blocks.data?.length ? (
          <Card padded={false}>
            {blocks.data.map((row, index) => (
              <BlockedRow
                key={row.blocked}
                uid={row.blocked}
                first={index === 0}
                busy={busy}
                onUnblock={() => void removeBlock(row.blocked)}
              />
            ))}
          </Card>
        ) : (
          <Text style={[type.meta, { color: t.textMuted }]}>{tr('privacy.noBlocks')}</Text>
        )}
      </View>
      <FormError text={failure ?? (blocks.error ? tr(errorKey(blocks.error)) : undefined)} />
      <View style={styles.location} accessible>
        <ShieldIcon color={t.primaryText} size={20} />
        <Text style={[type.meta, { color: t.text, flex: 1 }]}>{tr('privacy.location')}</Text>
      </View>
    </FormScreen>
  );
}

/** Engellenen kişi: avatar + ad; sağda "engeli kaldır" ikon düğmesi (etiketinde kişinin adı). */
function BlockedRow({ uid, first, busy, onUnblock }: { uid: string; first: boolean; busy: boolean; onUnblock: () => void }) {
  const { t: tr } = useT();
  const t = useSweetTheme();
  const person = usePerson(uid);
  const profile = person.data?.profile;
  const name = profile?.display_name ?? tr('person.title');
  // ListRow kullanılmaz: tıklanamayan satır tek erişilebilir öğe olur ve içindeki düğmeyi gizler.
  return (
    <View style={[styles.row, !first && { borderTopWidth: t.outlined ? 1 : StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
      <Avatar identity={profile ?? null} source={person.avatar} size={44} />
      <View style={{ flex: 1, gap: 2 }} accessible accessibilityLabel={[name, profile?.username ? `@${profile.username}` : null].filter(Boolean).join(', ')}>
        <Text style={[type.itemTitle, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        {profile?.username ? <Text style={[type.meta, { color: t.textMuted }]}>@{profile.username}</Text> : null}
      </View>
      <SoftPressable
        onPress={onUnblock}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={tr('person.unblockName', { name })}
        style={[styles.unblock, { backgroundColor: t.soft }, outline(t)]}>
        <BanIcon color={t.text} size={20} />
      </SoftPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  location: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, minHeight: 64 },
  unblock: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
