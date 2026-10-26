import { COMMUNITY_LICENSE } from '@sezi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { resize, type ProcessedImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';

const TabSchema = z.enum(['review', 'archive']);
type Tab = z.infer<typeof TabSchema>;
const PhotoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  work_slug: z.string(),
  path: z.string(),
  thumb_path: z.string(),
  alt_text: z.string(),
  caption: z.string().nullable(),
  credit_name: z.string().nullable(),
  review: z.enum(['none', 'pending', 'approved', 'rejected']),
  archive: z.enum(['none', 'suggested', 'accepted', 'declined']),
});
const WorkSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.object({ tr: z.string() }),
});
const ProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string(),
  username: z.string().nullable(),
});
const IdSchema = z.object({ id: z.string().uuid() });
const SignedSchema = z.object({
  path: z.string().nullable(),
  signedUrl: z.string(),
  error: z.string().nullable(),
});
type Photo = z.infer<typeof PhotoSchema>;
type Work = z.infer<typeof WorkSchema>;
type Profile = z.infer<typeof ProfileSchema>;
interface ModerationPhoto extends Photo {
  work: Work;
  profile: Profile;
}
type Action = {
  photo: ModerationPhoto;
  kind: 'approve' | 'reject' | 'accept' | 'decline';
};

function errorMessage(error: unknown): string {
  const result = z.object({ message: z.string() }).safeParse(error);
  return result.success ? result.data.message : 'İşlem tamamlanamadı.';
}

async function loadPhotos(tab: Tab): Promise<ModerationPhoto[]> {
  const rows: ModerationPhoto[] = [];
  for (let from = 0; ; from += 100) {
    const result = await supabase
      .from('user_photos')
      .select('id, user_id, work_slug, path, thumb_path, alt_text, caption, credit_name, review, archive')
      .eq(tab, tab === 'review' ? 'pending' : 'suggested')
      .order('created_at')
      .order('id')
      .range(from, from + 99);
    if (result.error) throw result.error;
    const photos = z.array(PhotoSchema).parse(result.data);
    if (!photos.length) break;
    const [workResult, profileResult] = await Promise.all([
      supabase
        .from('works')
        .select('id, slug, name')
        .in('slug', [...new Set(photos.map((p) => p.work_slug))]),
      supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .in('user_id', [...new Set(photos.map((p) => p.user_id))]),
    ]);
    if (workResult.error) throw workResult.error;
    if (profileResult.error) throw profileResult.error;
    const works = new Map(z.array(WorkSchema).parse(workResult.data).map((w) => [w.slug, w]));
    const profiles = new Map(z.array(ProfileSchema).parse(profileResult.data).map((p) => [p.user_id, p]));
    for (const photo of photos) {
      const work = works.get(photo.work_slug);
      const profile = profiles.get(photo.user_id);
      if (!work || !profile) throw new Error('Fotoğrafın eser veya profil bilgisi okunamadı.');
      rows.push({ ...photo, work, profile });
    }
    if (photos.length < 100) break;
  }
  return rows;
}

async function updatePhoto(
  id: string,
  patch: {
    review?: 'approved' | 'rejected';
    archive?: 'accepted' | 'declined';
    media_id?: string;
  },
) {
  const result = await supabase.from('user_photos').update(patch).eq('id', id).select('id').single();
  if (result.error) throw result.error;
  IdSchema.parse(result.data);
}

async function archivePhoto(photo: ModerationPhoto) {
  const paths: string[] = [];
  const mediaId = crypto.randomUUID();
  let inserted = false;
  try {
    const downloaded = await supabase.storage.from('user-photos').download(photo.path);
    if (downloaded.error) throw downloaded.error;
    const bitmap = await createImageBitmap(downloaded.data, { imageOrientation: 'from-image' });
    let full: ProcessedImage;
    let thumb: ProcessedImage;
    try {
      full = await resize(bitmap, 1600);
      thumb = await resize(bitmap, 480);
    } finally {
      bitmap.close();
    }
    const fullPath = `community/${photo.work_slug}/${photo.id}.webp`;
    const thumbPath = `community/${photo.work_slug}/${photo.id}_t.webp`;
    for (const [path, blob] of [
      [fullPath, full.blob],
      [thumbPath, thumb.blob],
    ] satisfies [string, Blob][]) {
      const uploaded = await supabase.storage.from('media').upload(path, blob, {
        contentType: 'image/webp',
        upsert: false,
      });
      if (uploaded.error) throw uploaded.error;
      paths.push(path);
    }
    const orderResult = await supabase
      .from('media')
      .select('sort_order')
      .eq('work_id', photo.work.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    if (orderResult.error) throw orderResult.error;
    const sortOrder = (z.array(z.object({ sort_order: z.number() })).parse(orderResult.data)[0]?.sort_order ?? -1) + 1;
    const result = await supabase.from('media').insert({
      id: mediaId,
      work_id: photo.work.id,
      origin: 'community',
      kind: 'photo',
      storage_path: fullPath,
      thumb_path: thumbPath,
      width: full.width,
      height: full.height,
      sort_order: sortOrder,
      status: 'draft',
      alt_text: { tr: photo.alt_text },
      author: photo.credit_name ?? photo.profile.display_name,
      license: COMMUNITY_LICENSE.name,
      license_url: COMMUNITY_LICENSE.url,
    });
    if (result.error) throw result.error;
    inserted = true;
    await updatePhoto(photo.id, { archive: 'accepted', media_id: mediaId });
  } catch (error) {
    let message = errorMessage(error);
    if (inserted) {
      const cleanup = await supabase.from('media').delete().eq('id', mediaId);
      if (cleanup.error) message += ` Taslak satırı temizlenemedi: ${cleanup.error.message}`;
    }
    if (paths.length) {
      const cleanup = await supabase.storage.from('media').remove(paths);
      if (cleanup.error) message += ` Yüklenen dosyalar temizlenemedi: ${cleanup.error.message}`;
    }
    throw new Error(message);
  }
}

function PhotoPreview({ photo }: { photo: Photo }) {
  const urls = useQuery({
    queryKey: ['community-photo-url', photo.id, photo.thumb_path],
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
    queryFn: async () => {
      const result = await supabase.storage.from('user-photos').createSignedUrls([photo.thumb_path], 3600);
      if (result.error) throw result.error;
      const row = z.array(SignedSchema).parse(result.data)[0];
      if (!row?.signedUrl || row.error) throw new Error(row?.error ?? 'Fotoğraf adresi alınamadı.');
      return row.signedUrl;
    },
  });
  if (urls.isPending) return <Skeleton className="h-64 w-full" />;
  if (urls.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Fotoğraf yüklenemedi</AlertTitle>
        <AlertDescription>
          {urls.error.message}
          <Button className="min-h-12" variant="outline" onClick={() => void urls.refetch()}>
            Yeniden dene
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <img
      src={urls.data}
      alt={photo.alt_text}
      className="max-h-96 w-full rounded-lg bg-muted object-contain"
    />
  );
}

export function CommunityPhotos() {
  const [tab, setTab] = useState<Tab>('review');
  const qc = useQueryClient();
  const photos = useQuery({
    queryKey: ['community-photos', tab],
    queryFn: () => loadPhotos(tab),
  });
  const moderation = useMutation({
    mutationFn: async ({ photo, kind }: Action) => {
      if (kind === 'accept') await archivePhoto(photo);
      else if (kind === 'decline') await updatePhoto(photo.id, { archive: 'declined' });
      else await updatePhoto(photo.id, { review: kind === 'approve' ? 'approved' : 'rejected' });
      return kind;
    },
    onSuccess: (kind, { photo }) => {
      for (const key of [
        ['community-photos'],
        ['dashboard'],
        ['inbox'],
        ['works'],
        ['work', photo.work_slug],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      toast.success({
        approve: 'Fotoğraf yayımlandı.',
        reject: 'Fotoğraf reddedildi.',
        accept: 'Fotoğraf arşive taslak olarak alındı. Fotoğraf kutusundan yayınlayabilirsiniz.',
        decline: 'Arşiv önerisi geri çevrildi.',
      }[kind]);
    },
    onError: (error) => toast.error(`İşlem başarısız: ${errorMessage(error)}`),
  });
  return (
    <>
      <PageHeader />
      <Tabs value={tab} onValueChange={(value) => setTab(TabSchema.parse(value))}>
        <TabsList aria-label="Fotoğraf moderasyonu" className="min-h-12">
          <TabsTrigger value="review" className="min-h-12">
            Yayın onayı
          </TabsTrigger>
          <TabsTrigger value="archive" className="min-h-12">
            Arşiv önerileri
          </TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="flex flex-col gap-6 pt-4">
          {tab === 'archive' ? (
            <Alert>
              <AlertTitle>Arşiv kopyaları taslak olarak kaydedilir</AlertTitle>
              <AlertDescription>
                Fotoğraflar, yükleyenin adı ve CC BY 4.0 izniyle arşivlenir. Yayın için{' '}
                <Link
                  to="/fotograflar?tab=draft"
                  className="inline-flex min-h-12 items-center underline"
                >
                  Fotoğraf kutusunu açın
                </Link>.
              </AlertDescription>
            </Alert>
          ) : null}
          {photos.error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Fotoğraflar alınamadı</AlertTitle>
              <AlertDescription>
                {photos.error.message}
                <Button variant="outline" className="min-h-12" onClick={() => void photos.refetch()}>
                  Yeniden dene
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          {photos.isPending ? (
            <Skeleton className="h-96 w-full rounded-xl" />
          ) : !photos.error && !photos.data?.length ? (
            <Empty className="border bg-card">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Camera />
                </EmptyMedia>
                <EmptyTitle>
                  {tab === 'review' ? 'Yayın onayı bekleyen fotoğraf yok' : 'Bekleyen arşiv önerisi yok'}
                </EmptyTitle>
                <EmptyDescription>
                  {tab === 'review'
                    ? 'Herkese açılmak istenen kullanıcı fotoğrafları burada incelenir.'
                    : 'Sezi arşivine önerilen fotoğraflar burada incelenir.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            {photos.data?.map((photo) => (
              <Card key={photo.id}>
                <CardHeader>
                  <CardTitle>
                    <Link
                      to={`/eserler/${photo.work.slug}`}
                      className="inline-flex min-h-12 items-center underline"
                    >
                      {photo.work.name.tr}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {photo.profile.display_name}
                    {photo.profile.username ? ` · @${photo.profile.username}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <PhotoPreview photo={photo} />
                  <div>
                    <p className="text-sm font-medium">Alt metin</p>
                    <p className="break-words text-sm">{photo.alt_text}</p>
                  </div>
                  {photo.caption ? (
                    <div>
                      <p className="text-sm font-medium">Açıklama</p>
                      <p className="break-words text-sm">{photo.caption}</p>
                    </div>
                  ) : null}
                  <Badge variant="outline">
                    {tab === 'review' ? 'Yayın onayı bekliyor' : 'Arşive önerildi'}
                  </Badge>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-3">
                  <Button
                    className="min-h-12"
                    disabled={moderation.isPending}
                    onClick={() => moderation.mutate({
                      photo,
                      kind: tab === 'review' ? 'approve' : 'accept',
                    })}
                  >
                    {moderation.isPending && moderation.variables.photo.id === photo.id
                      ? 'İşleniyor…'
                      : tab === 'review' ? 'Yayınla' : 'Arşive al'}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-12"
                    disabled={moderation.isPending}
                    onClick={() => moderation.mutate({
                      photo,
                      kind: tab === 'review' ? 'reject' : 'decline',
                    })}
                  >
                    {tab === 'review' ? 'Reddet' : 'Geri çevir'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
