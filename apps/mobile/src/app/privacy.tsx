import { type IdentityPatch, type Visibility } from '@sezi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { Button, Card, EmptyState, ListRow, Note, SectionTitle, Segmented, ToggleRow } from '@/components/ui';
import { space } from '@/design/type';
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
  // Segmented dar: profil için kısa etiketler; fotoğraf varsayılanı fotoğraf ekranıyla aynı etiketleri kullanır.
  const options: { value: Visibility; label: string }[] = [
    { value: 'private', label: tr('account.visPrivate') },
    { value: 'friends', label: tr('photos.vis.friends') },
    { value: 'public', label: tr('account.visPublic') },
  ];
  const photoOptions: { value: Visibility; label: string }[] = [
    { value: 'private', label: tr('photos.vis.private') },
    { value: 'friends', label: tr('photos.vis.friends') },
    { value: 'public', label: tr('photos.vis.public') },
  ];
  if (!user)
    return (
      <FormScreen>
        <EmptyState
          title={tr('friends.signIn')}
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
        style={{ gap: space.md }}
        pointerEvents={busy ? 'none' : 'auto'}
        accessibilityState={{ busy }}>
        <SectionTitle title={tr('privacy.visibility')} />
        <Segmented
          label={tr('privacy.visibility')}
          value={identity.visibility}
          options={options}
          onChange={(visibility) => void update({ visibility })}
        />
        <Note text={tr(`privacy.vis.${identity.visibility}`)} />
        <Card padded={false}>
          <ToggleRow
            first
            title={tr('privacy.findable')}
            subtitle={tr('privacy.findableHelp')}
            value={identity.findable}
            onChange={(findable) => void update({ findable })}
          />
        </Card>
        <SectionTitle title={tr('privacy.photoDefault')} />
        <Segmented
          label={tr('privacy.photoDefault')}
          value={identity.photo_default}
          options={photoOptions}
          onChange={(photo_default) => void update({ photo_default })}
        />
      </View>
      <SectionTitle title={tr('privacy.blocked')} />
      {blocks.isLoading ? (
        <ActivityIndicator color={t.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : blocks.data?.length ? (
        <Card>
          {blocks.data.map((row) => (
            <BlockedRow
              key={row.blocked}
              uid={row.blocked}
              busy={busy}
              onUnblock={() => void removeBlock(row.blocked)}
            />
          ))}
        </Card>
      ) : (
        <Note text={tr('privacy.noBlocks')} />
      )}
      <FormError text={failure ?? (blocks.error ? tr(errorKey(blocks.error)) : undefined)} />
      <Note text={tr('privacy.location')} />
    </FormScreen>
  );
}

function BlockedRow({ uid, busy, onUnblock }: { uid: string; busy: boolean; onUnblock: () => void }) {
  const { t: tr } = useT();
  const person = usePerson(uid);
  return (
    <View style={{ gap: space.sm }}>
      <ListRow
        first
        title={person.data?.profile.display_name ?? tr('person.title')}
        subtitle={person.data?.profile.username ? `@${person.data.profile.username}` : undefined}
      />
      <Button compact variant="outline" label={tr('person.unblock')} disabled={busy} onPress={onUnblock} />
    </View>
  );
}
