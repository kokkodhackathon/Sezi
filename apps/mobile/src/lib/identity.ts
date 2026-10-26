import { fallbackDisplayName, IdentitySchema, type Identity, type IdentityPatch } from '@sezi/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import Storage from 'expo-sqlite/kv-store';
import { useCallback } from 'react';
import { z } from 'zod';

import { errorKey, IDENTITY_KEY, useAccount } from './account';
import type { MessageKey } from './i18n';
import { privateObject, supabase } from './supabase';

/**
 * Hesabın kimliği (`profiles`): görünen ad, @kullanıcı adı, profil fotoğrafı, baş harf rengi ve görünürlük.
 * Tercihlerden (`accounts`, yalnız sahibi) ayrıdır; görünürlük ve bulunabilirlik profil erişimini belirler.
 * Satır ilk girişte istemci tarafından açılır (RLS).
 * İnternetsizken son bilinen hâl cihazdan gelir.
 */
const COLUMNS = 'user_id, display_name, username, avatar_path, avatar_tone, visibility, findable, photo_default';
const KEY = IDENTITY_KEY;
const AVATAR_SIZE = 512;

function cached(uid: string): Identity | undefined {
  try {
    const parsed = IdentitySchema.safeParse(JSON.parse(Storage.getItemSync(KEY) ?? 'null'));
    return parsed.success && parsed.data.user_id === uid ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

const UniqueViolation = z.object({ code: z.literal('23505') });

/** Kimlik hatası → ileti: alınmış kullanıcı adı ayrı; gerisi hesap hatalarıyla aynı. */
export function identityErrorKey(e: unknown): MessageKey {
  if (UniqueViolation.safeParse(e).success) return 'account.err.username_taken';
  return errorKey(e);
}

/** Baş harfler: adın ilk iki kelimesi (Türkçe büyük harf kuralıyla). */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr'))
    .join('');
}

export function useIdentity() {
  const qc = useQueryClient();
  const { user, session } = useAccount();
  const uid = user?.id;

  const query = useQuery({
    queryKey: ['identity', uid],
    enabled: !!uid,
    queryFn: async (): Promise<Identity> => {
      const read = () => supabase.from('profiles').select(COLUMNS).eq('user_id', uid!).maybeSingle();
      let { data, error } = await read();
      if (error) throw error;
      if (!data) {
        // İlk giriş: kayıtta verilen ad (yoksa e-postanın başı) ile satır açılır.
        const name = fallbackDisplayName(user?.user_metadata?.display_name, user?.email);
        const inserted = await supabase.from('profiles').insert({ user_id: uid!, display_name: name }).select(COLUMNS).single();
        if (inserted.error && !UniqueViolation.safeParse(inserted.error).success) throw inserted.error;
        ({ data, error } = inserted.error ? await read() : inserted);
        if (error) throw error;
      }
      const row = IdentitySchema.parse(data);
      Storage.setItemSync(KEY, JSON.stringify(row));
      return row;
    },
    placeholderData: () => (uid ? cached(uid) : undefined),
  });

  const store = useCallback(
    (row: Identity) => {
      Storage.setItemSync(KEY, JSON.stringify(row));
      qc.setQueryData(['identity', row.user_id], row);
    },
    [qc],
  );

  const update = useCallback(
    async (patch: Record<string, string | boolean | null>) => {
      if (!uid) return;
      const { data, error } = await supabase.from('profiles').update(patch).eq('user_id', uid).select(COLUMNS).single();
      if (error) throw error;
      store(IdentitySchema.parse(data));
    },
    [uid, store],
  );

  const save = useCallback((patch: IdentityPatch) => update(patch), [update]);

  /** Seçilen fotoğraf 512 px kareye küçültülüp yüklenir; eskisi silinir. Adres her yüklemede yenidir (önbellek). */
  const setAvatar = useCallback(
    async (localUri: string) => {
      if (!uid) return;
      const ctx = ImageManipulator.manipulate(localUri);
      ctx.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });
      const image = await ctx.renderAsync();
      const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      const body = await (await fetch(out.uri)).arrayBuffer();
      const path = `${uid}/${Date.now()}.jpg`;
      const up = await supabase.storage.from('avatars').upload(path, body, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const old = query.data?.avatar_path;
      await update({ avatar_path: path });
      if (old) void supabase.storage.from('avatars').remove([old]);
    },
    [uid, update, query.data?.avatar_path],
  );

  const removeAvatar = useCallback(async () => {
    const old = query.data?.avatar_path;
    if (!old) return;
    await update({ avatar_path: null });
    void supabase.storage.from('avatars').remove([old]);
  }, [update, query.data?.avatar_path]);

  const identity = query.data ?? null;
  const avatar = identity?.avatar_path && session ? privateObject('avatars', identity.avatar_path, session.access_token) : null;
  return { identity, avatar, loading: query.isLoading, save, setAvatar, removeAvatar };
}
