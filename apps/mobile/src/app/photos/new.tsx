import { loc } from '@sezi/shared';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { PhotoFields, type PhotoFieldsValue } from '@/components/photo-fields';
import { Button, EmptyState, Field, ListRow } from '@/components/ui';
import { CameraIcon, CloseIcon, ImageIcon, SearchIcon } from '@/design/icons';
import { IconBubble, outline, SoftPressable } from '@/design/sweet/components';
import { radius, space, type } from '@/design/type';
import { WorkGlyph } from '@/design/work-glyph';
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
      {/* 1. Fotoğraf: seçilmemişse kesikli alan içinde iki büyük eylem; seçilince fotoğraf ve "değiştir". */}
      {asset ? (
        <View>
          <Image
            source={asset.uri}
            accessibilityLabel={fields.altText || tr('photos.alt')}
            contentFit="cover"
            style={{
              width: '100%',
              aspectRatio: Math.max(0.75, Math.min(1.6, asset.width / asset.height)),
              borderRadius: radius.lg,
              backgroundColor: theme.soft,
            }}
          />
          <View style={styles.change}>
            <IconBubble icon={(c) => <ImageIcon color={c} />} label={tr('photos.changePhoto')} onPress={() => void pick('library')} />
          </View>
        </View>
      ) : (
        <View style={[styles.drop, { borderColor: theme.border }]}>
          <PickButton icon={CameraIcon} label={tr('photos.take')} disabled={busy || picking} onPress={() => void pick('camera')} />
          <PickButton icon={ImageIcon} label={tr('photos.pick')} disabled={busy || picking} onPress={() => void pick('library')} />
        </View>
      )}

      {/* 2. Eser: seçiliyse glifli çip, değilse arama. */}
      {selected ? (
        <View style={[styles.workChip, { backgroundColor: theme.surface }, outline(theme)]}>
          <WorkGlyph slug={selected.type_slug} size={44} />
          <Text style={[type.itemTitle, { color: theme.text, flex: 1 }]} numberOfLines={2}>
            {loc(selected.name, lang)}
          </Text>
          <IconBubble icon={(c) => <CloseIcon color={c} size={18} />} label={tr('photos.changeWork')} onPress={() => setWorkSlug('')} />
        </View>
      ) : (
        <View style={{ gap: space.sm }}>
          <Field
            label={tr('photos.search')}
            value={search}
            onChangeText={setSearch}
            editable={!busy}
            icon={(c) => <SearchIcon color={c} size={20} />}
          />
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
          {search.trim() ? (
            <View style={[styles.results, { backgroundColor: theme.surface }, outline(theme)]}>
              {matches.slice(0, 8).map((row, index) => (
                <ListRow
                  key={row.slug}
                  first={index === 0}
                  leading={<WorkGlyph slug={row.type_slug} size={36} />}
                  title={loc(row.name, lang)}
                  subtitle={loc(row.city_name, lang)}
                  onPress={() => {
                    setWorkSlug(row.slug);
                    setSearch('');
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      )}

      {/* 3. Alt metin, açıklama, görünürlük, arşiv. */}
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

/** Büyük seçim düğmesi: simge dairesi + kısa ad (kesikli alanın içinde). */
function PickButton({
  icon: I,
  label,
  onPress,
  disabled,
}: {
  icon: typeof CameraIcon;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useSweetTheme();
  return (
    <SoftPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.pick, disabled && { opacity: 0.4 }]}>
      <View style={[styles.pickIcon, { backgroundColor: theme.primary.fill }, outline(theme)]}>
        <I color={theme.outlined ? theme.text : theme.primary.ink} size={30} />
      </View>
      <Text style={[type.cardTitle, { color: theme.text, textAlign: 'center' }]}>{label}</Text>
    </SoftPressable>
  );
}

const styles = StyleSheet.create({
  drop: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    minHeight: 180,
    alignItems: 'center',
  },
  pick: { flex: 1, alignItems: 'center', gap: space.sm, paddingVertical: space.lg, minHeight: 48 },
  pickIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  change: { position: 'absolute', right: space.sm, bottom: space.sm },
  workChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  results: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
});
