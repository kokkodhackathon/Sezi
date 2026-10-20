import { mediaUrl, type WorkPhoto } from "@sezi/shared";

/** Herkese açık Storage kovaları: envanter fotoğrafları (`media`) ve admin'den yüklenen ses kayıtları (`audio`). */
export const MEDIA_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/`;
export const AUDIO_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/`;

export const photoUrl = (p: WorkPhoto, size: "thumb" | "full" = "full"): string => mediaUrl(MEDIA_BASE, p, size);
