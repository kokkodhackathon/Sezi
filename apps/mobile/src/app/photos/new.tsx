import { loc } from '@sezi/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { PhotoFields, type PhotoFieldsValue } from '@/components/photo-fields';
import { Button, EmptyState, Field, ListRow } from '@/components/ui';
import { CameraIcon } from '@/design/icons';
import { radius, space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { useIdentity } from '@/lib/identity';
import { photoErrorKey, usePhotoActions } from '@/lib/photos';
import { useWorks } from '@/lib/works';

export default function NewPhotoScreen() {
  const { work } = useLocalSearchParams<{ work?: string }>();
  const { user } = useAccount();
  const { identity, loading } = useIdentity();
  const { t: tr } = useT();
  const theme = useSweetTheme();
  if (!user)
    return (
      <FormScreen>
        <EmptyState
          title={tr('photos.title')}
          body={tr('photos.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  if (loading || !identity)
    return (
      <FormScreen>
        <ActivityIndicator color={theme.primaryText} accessibilityLabel={tr('account.loading')} />
      </FormScreen>
    );
  return <Editor initialWork={work} initialVisibility={identity.photo_default} />;
}

function Editor({
  initialWork,
  initialVisibility,
}: {
  initialWork?: string;
  initialVisibility: PhotoFieldsValue['visibility'];
}) {
  const { t: tr, lang } = useT();
  const theme = useSweetTheme();
  const works = useWorks();
  const actions = usePhotoActions();
  const [workSlug, setWorkSlug] = useState(initialWork ?? '');
  const [search, setSearch] = useState('');
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fields, setFields] = useState<PhotoFieldsValue>({
    altText: '',
    caption: '',
    visibility: initialVisibility,
    suggestArchive: false,
  });
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string>();
  const selected = works.data?.find((row) => row.slug === workSlug);
  const matches = (works.data ?? [])
    .filter((row) =>
      `${row.name.tr} ${row.name.en ?? ''} ${row.slug}`
        .toLocaleLowerCase(lang)
        .includes(search.trim().toLocaleLowerCase(lang)),
    )
    .slice(0, 20);

  const pick = async (source: 'camera' | 'library') => {
    if (picking || busy) return;
    setPicking(true);
    setError(undefined);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError(tr('photos.err.permission'));
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], exif: false, quality: 1 };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setAsset(result.assets[0]);
    } catch (e) {
      setError(tr(photoErrorKey(e)));
    } finally {
      setPicking(false);
    }
  };
  const save = async () => {
    if (busy) return;
    if (!selected || !asset || !fields.altText.trim()) {
      setError(tr('photos.err.required'));
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await actions.uploadPhoto({
        localUri: asset.uri,
        width: asset.width,
        height: asset.height,
        workSlug,
        ...fields,
      });
      AccessibilityInfo.announceForAccessibility(tr('photos.saved'));
      router.back();
    } catch (e) {
      setError(tr(photoErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScreen>
      {selected ? (
        <View style={{ gap: space.sm }}>
          <ListRow
            title={loc(selected.name, lang)}
            subtitle={tr('photos.work')}
            onPress={() => router.push({ pathname: '/work/[slug]', params: { slug: selected.slug } })}
          />
          <Button
            variant="ghost"
            label={tr('photos.changeWork')}
            disabled={busy}
            onPress={() => setWorkSlug('')}
          />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Field label={tr('photos.search')} value={search} onChangeText={setSearch} editable={!busy} />
          {works.isLoading ? (
            <ActivityIndicator color={theme.primaryText} accessibilityLabel={tr('account.loading')} />
          ) : null}
          <FormError text={works.error ? tr(photoErrorKey(works.error)) : undefined} />
          {works.error ? (
            <Button variant="secondary" label={tr('explore.retry')} onPress={() => void works.refetch()} />
          ) : null}
          {!works.isLoading && !works.error && matches.length === 0 ? (
            <EmptyState title={tr('photos.noWorks')} />
          ) : null}
          {matches.map((row) => (
            <ListRow
              key={row.slug}
              title={loc(row.name, lang)}
              subtitle={loc(row.city_name, lang)}
              onPress={() => setWorkSlug(row.slug)}
            />
          ))}
        </View>
      )}
      {asset ? (
        <Image
          source={asset.uri}
          accessibilityLabel={fields.altText || tr('photos.alt')}
          contentFit="contain"
          style={{
            width: '100%',
            aspectRatio: asset.width / asset.height,
            maxHeight: 420,
            borderRadius: radius.lg,
            backgroundColor: theme.soft,
          }}
        />
      ) : null}
      <View style={{ gap: space.sm }}>
        <Button
          variant="secondary"
          icon={(color) => <CameraIcon color={color} />}
          label={tr('photos.take')}
          disabled={busy || picking}
          onPress={() => void pick('camera')}
        />
        <Button
          variant="secondary"
          label={tr('photos.pick')}
          disabled={busy || picking}
          onPress={() => void pick('library')}
        />
      </View>
      <PhotoFields value={fields} onChange={setFields} disabled={busy} />
      <FormError text={error} />
      <Button
        label={tr(busy ? 'photos.saving' : 'photos.save')}
        disabled={busy || picking}
        onPress={() => void save()}
      />
    </FormScreen>
  );
}
