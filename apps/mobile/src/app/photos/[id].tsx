import { loc, type UserPhoto } from '@sezi/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { PhotoFields, PhotoStatus, type PhotoFieldsValue } from '@/components/photo-fields';
import { Button, EmptyState, ListRow } from '@/components/ui';
import { radius, space, type } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { photoErrorKey, usePhoto, usePhotoActions, usePhotoUrls } from '@/lib/photos';
import { useWork } from '@/lib/works';

export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const photo = usePhoto(id);
  const { t: tr } = useT();
  const theme = useSweetTheme();
  if (photo.isLoading)
    return (
      <FormScreen>
        <ActivityIndicator color={theme.primaryText} accessibilityLabel={tr('account.loading')} />
      </FormScreen>
    );
  if (photo.error)
    return (
      <FormScreen>
        <FormError text={tr(photoErrorKey(photo.error))} />
        <Button variant="secondary" label={tr('explore.retry')} onPress={() => void photo.refetch()} />
      </FormScreen>
    );
  if (!photo.data)
    return (
      <FormScreen>
        <EmptyState title={tr('photos.notFound')} />
      </FormScreen>
    );
  return <PhotoDetail key={photo.data.id} photo={photo.data} />;
}

function PhotoDetail({ photo }: { photo: UserPhoto }) {
  const { user } = useAccount();
  const owner = user?.id === photo.user_id;
  const { t: tr, lang } = useT();
  const theme = useSweetTheme();
  const work = useWork(photo.work_slug);
  const urls = usePhotoUrls([photo.path]);
  const actions = usePhotoActions();
  const [fields, setFields] = useState<PhotoFieldsValue>({
    altText: photo.alt_text,
    caption: photo.caption ?? '',
    visibility: photo.visibility,
    suggestArchive: photo.archive === 'suggested',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    if (busy) return;
    if (!fields.altText.trim()) {
      setError(tr('photos.err.required'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await actions.updatePhoto(photo.id, {
        alt_text: fields.altText.trim(),
        caption: fields.caption.trim() || null,
        visibility: fields.visibility,
        archive: photo.archive === 'accepted' ? 'accepted' : fields.suggestArchive ? 'suggested' : 'none',
      });
      AccessibilityInfo.announceForAccessibility(tr('photos.saved'));
      router.back();
    } catch (e) {
      setError(tr(photoErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await actions.deletePhoto(photo);
      router.back();
    } catch (e) {
      setError(tr(photoErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = () =>
    Alert.alert(tr('photos.deleteTitle'), tr('photos.deleteBody'), [
      { text: tr('photos.cancel'), style: 'cancel' },
      { text: tr('photos.delete'), style: 'destructive', onPress: () => void remove() },
    ]);

  return (
    <FormScreen>
      <Image
        source={urls.data?.[photo.path]}
        accessibilityLabel={photo.alt_text}
        contentFit="contain"
        style={{
          width: '100%',
          aspectRatio: photo.width / photo.height,
          maxHeight: 520,
          borderRadius: radius.lg,
          backgroundColor: theme.soft,
        }}
      />
      {urls.isLoading ? (
        <ActivityIndicator color={theme.primaryText} accessibilityLabel={tr('account.loading')} />
      ) : null}
      {urls.error ? (
        <View style={{ gap: space.sm }}>
          <FormError text={tr(photoErrorKey(urls.error))} />
          <Button variant="secondary" label={tr('explore.retry')} onPress={() => void urls.refetch()} />
        </View>
      ) : null}
      <PhotoStatus photo={photo} />
      <ListRow
        title={work.data ? loc(work.data.name, lang) : photo.work_slug}
        subtitle={tr('photos.work')}
        onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: photo.work_slug } })}
      />
      {owner ? (
        <>
          <PhotoFields
            value={fields}
            onChange={setFields}
            accepted={photo.archive === 'accepted'}
            disabled={busy}
          />
          <FormError text={error} />
          <Button
            label={tr(busy ? 'photos.saving' : 'photos.save')}
            disabled={busy}
            onPress={() => void save()}
          />
          <Button variant="danger" label={tr('photos.delete')} disabled={busy} onPress={confirmDelete} />
        </>
      ) : (
        <View style={{ gap: space.md }}>
          <Text style={[type.body, { color: theme.text }]}>{photo.alt_text}</Text>
          {photo.caption ? <Text style={[type.body, { color: theme.text }]}>{photo.caption}</Text> : null}
        </View>
      )}
    </FormScreen>
  );
}
