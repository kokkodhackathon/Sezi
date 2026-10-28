import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { FormError, FormScreen } from '@/components/account-fields';
import { SeziLoader } from '@/components/sezi-loader';
import { PhotoGrid } from '@/components/social-grids';
import { EmptyInvite, EmptyPhotoArt } from '@/components/social-visuals';
import { Button } from '@/components/ui';
import { space } from '@/design/type';
import { useSweetTheme } from '@/hooks/use-sweet-theme';
import { useAccount } from '@/lib/account';
import { useT } from '@/lib/i18n';
import { photoErrorKey, useMyPhotos, usePhotoUrls } from '@/lib/photos';

/** Fotoğraflarım: ilk hücre "ekle", sonra kare küçük resimler; durum köşedeki simgelerde. */
export default function PhotosScreen() {
  const { work } = useLocalSearchParams<{ work?: string }>();
  const { user } = useAccount();
  const { t: tr } = useT();
  const theme = useSweetTheme();
  const photos = useMyPhotos(work);
  const urls = usePhotoUrls((photos.data ?? []).map((photo) => photo.thumb_path));
  const add = () => router.push({ pathname: '/photos/new', params: work ? { work } : {} });
  if (!user)
    return (
      <FormScreen>
        <EmptyInvite
          art={<EmptyPhotoArt />}
          text={tr('photos.signIn')}
          action={<Button label={tr('account.signIn')} onPress={() => router.push('/account/sign-in')} />}
        />
      </FormScreen>
    );
  const error = photos.error ?? urls.error;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: space.xxl }}>
      {error ? (
        <View style={{ gap: space.sm }}>
          <FormError text={tr(photoErrorKey(error))} />
          <Button
            variant="secondary"
            label={tr('explore.retry')}
            onPress={() => {
              void photos.refetch();
              void urls.refetch();
            }}
          />
        </View>
      ) : null}
      {photos.isLoading ? <SeziLoader label={tr('account.loading')} /> : null}
      {!photos.isLoading && !photos.error && !photos.data?.length ? (
        <EmptyInvite art={<EmptyPhotoArt />} text={tr('photos.emptyInvite')} action={<Button label={tr('photos.add')} onPress={add} />} />
      ) : (
        <PhotoGrid
          photos={photos.data ?? []}
          urls={urls.data}
          onAdd={add}
          onOpen={(photo) => router.push({ pathname: '/photos/[id]', params: { id: photo.id } })}
        />
      )}
    </ScrollView>
  );
}
