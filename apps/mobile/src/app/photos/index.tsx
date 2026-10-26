import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { PhotoStatus } from '@/components/photo-fields';
import { Button, EmptyState } from '@/components/ui';
import { SoftPressable } from '@/design/sweet/components';
import { radius, space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { photoErrorKey, useMyPhotos, usePhotoUrls } from '@/lib/photos';

export default function PhotosScreen() {
  const { work } = useLocalSearchParams<{ work?: string }>();
  const { user } = useAccount();
  const { t: tr } = useT();
  const theme = useSweetTheme();
  const photos = useMyPhotos(work);
  const urls = usePhotoUrls((photos.data ?? []).map((photo) => photo.thumb_path));
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
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <FlatList
        data={photos.data ?? []}
        numColumns={3}
        keyExtractor={(photo) => photo.id}
        contentContainerStyle={styles.content}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={
          <View style={styles.header}>
            <Button
              label={tr('photos.add')}
              onPress={() => router.push({ pathname: '/photos/new', params: work ? { work } : {} })}
            />
            <FormError
              text={
                photos.error
                  ? tr(photoErrorKey(photos.error))
                  : urls.error
                    ? tr(photoErrorKey(urls.error))
                    : undefined
              }
            />
            {photos.error || urls.error ? (
              <Button
                variant="secondary"
                label={tr('explore.retry')}
                onPress={() => {
                  void photos.refetch();
                  void urls.refetch();
                }}
              />
            ) : null}
            {photos.isLoading ? (
              <ActivityIndicator color={theme.primaryText} accessibilityLabel={tr('account.loading')} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !photos.isLoading && !photos.error ? (
            <EmptyState title={tr('photos.empty')} body={tr('photos.emptyBody')} />
          ) : null
        }
        renderItem={({ item }) => (
          <SoftPressable
            accessibilityRole="button"
            accessibilityLabel={item.alt_text}
            onPress={() => router.push({ pathname: '/photos/[id]', params: { id: item.id } })}
            style={styles.cell}>
            <Image
              source={urls.data?.[item.thumb_path]}
              accessibilityLabel={item.alt_text}
              style={[styles.image, { backgroundColor: theme.soft }]}
              contentFit="cover"
            />
            <PhotoStatus photo={item} />
          </SoftPressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
  header: { gap: space.md, marginBottom: space.md },
  row: { gap: space.sm },
  cell: { width: '31.5%', minHeight: 48, gap: space.sm },
  image: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
});
