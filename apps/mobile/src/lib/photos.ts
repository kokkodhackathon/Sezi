import {
  PHOTO_MAX_EDGE,
  PHOTO_THUMB_EDGE,
  UserPhotoSchema,
  type UserPhoto,
  type Visibility,
} from '@sezi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { z } from 'zod';

import { errorKey, useAccount } from './account';
import type { MessageKey } from './i18n';
import { supabase } from './supabase';
import { uuid } from './uuid';

const BUCKET = 'user-photos';
const Photos = z.array(UserPhotoSchema);

export function useMyPhotos(workSlug?: string) {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['photos', 'mine', user?.id, workSlug],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (workSlug) query = query.eq('work_slug', workSlug);
      const { data, error } = await query;
      if (error) throw error;
      return Photos.parse(data);
    },
  });
}

export function usePersonPhotos(uid: string) {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['photos', 'person', uid, user?.id ?? 'guest'],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return Photos.parse(data);
    },
  });
}

export function useWorkCommunityPhotos(slug: string) {
  return useQuery({
    queryKey: ['photos', 'work', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('work_slug', slug)
        .eq('visibility', 'public')
        .eq('review', 'approved')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return Photos.parse(data);
    },
  });
}

export function usePhoto(id: string) {
  const { user } = useAccount();
  return useQuery({
    queryKey: ['photos', 'detail', id, user?.id ?? 'guest'],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_photos').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? UserPhotoSchema.parse(data) : null;
    },
  });
}

/** Özel kovanın tek erişim yolu; oturum değişince başka hesabın imzaları kullanılmaz. */
export function usePhotoUrls(paths: string[]) {
  const { user } = useAccount();
  const unique = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ['photo-urls', user?.id ?? 'guest', unique],
    enabled: unique.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 3600);
      if (error) throw error;
      const urls: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row.error) throw new Error(row.error);
        if (row.path && row.signedUrl) urls[row.path] = row.signedUrl;
      }
      return urls;
    },
  });
}

export function photoErrorKey(error: unknown): MessageKey {
  const parsed = z.object({ message: z.string() }).safeParse(error);
  return parsed.success && parsed.data.message.includes('sınırına') ? 'photos.err.limit' : errorKey(error);
}

export interface PhotoUpload {
  localUri: string;
  width: number;
  height: number;
  workSlug: string;
  altText: string;
  caption: string;
  visibility: Visibility;
  suggestArchive: boolean;
}

export async function uploadPhoto(input: PhotoUpload): Promise<UserPhoto> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Oturum gerekli');
  const id = uuid();
  const paths = [`${auth.user.id}/${id}.jpg`, `${auth.user.id}/${id}_t.jpg`];
  const uploaded: string[] = [];
  const render = async (edge: number, compress: number) => {
    const context = ImageManipulator.manipulate(input.localUri);
    const target = Math.min(edge, Math.max(input.width, input.height));
    context.resize(input.width >= input.height ? { width: target } : { height: target });
    const image = await context.renderAsync();
    return image.saveAsync({ format: SaveFormat.JPEG, compress });
  };
  try {
    const full = await render(PHOTO_MAX_EDGE, 0.82);
    const thumb = await render(PHOTO_THUMB_EDGE, 0.75);
    for (const [index, image] of [full, thumb].entries()) {
      const path = paths[index]!;
      const body = await (await fetch(image.uri)).arrayBuffer();
      const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: 'image/jpeg' });
      if (error) throw error;
      uploaded.push(path);
    }
    const { data, error } = await supabase
      .from('user_photos')
      .insert({
        id,
        user_id: auth.user.id,
        work_slug: input.workSlug,
        path: paths[0],
        thumb_path: paths[1],
        width: full.width,
        height: full.height,
        alt_text: input.altText.trim(),
        caption: input.caption.trim() || null,
        taken_at: new Date().toISOString().slice(0, 10),
        visibility: input.visibility,
        archive: input.suggestArchive ? 'suggested' : 'none',
      })
      .select('*')
      .single();
    if (error) throw error;
    return UserPhotoSchema.parse(data);
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw error;
  }
}

export type PhotoPatch = Partial<Pick<UserPhoto, 'alt_text' | 'caption' | 'visibility' | 'archive'>>;
export async function updatePhoto(id: string, patch: PhotoPatch): Promise<UserPhoto> {
  const { data, error } = await supabase.from('user_photos').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return UserPhotoSchema.parse(data);
}

export async function deletePhoto(photo: UserPhoto): Promise<void> {
  const { error } = await supabase.from('user_photos').delete().eq('id', photo.id);
  if (error) throw error;
  const removed = await supabase.storage.from(BUCKET).remove([photo.path, photo.thumb_path]);
  if (removed.error) throw removed.error;
}

/** Ekranların aynı önbellek geçersizleştirme desenini kullanmasını sağlar. */
export function usePhotoActions() {
  const client = useQueryClient();
  const invalidate = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['photos'] }),
      client.invalidateQueries({ queryKey: ['contributions'] }),
      client.invalidateQueries({ queryKey: ['photo-urls'] }),
    ]);
  };
  return {
    uploadPhoto: async (input: PhotoUpload) => {
      const photo = await uploadPhoto(input);
      await invalidate();
      return photo;
    },
    updatePhoto: async (id: string, patch: PhotoPatch) => {
      const photo = await updatePhoto(id, patch);
      await invalidate();
      return photo;
    },
    deletePhoto: async (photo: UserPhoto) => {
      try {
        await deletePhoto(photo);
      } finally {
        await invalidate();
      }
    },
  };
}
