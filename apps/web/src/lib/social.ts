"use client";

import {
  CityRowSchema,
  ContributionsSchema,
  FriendshipRowSchema,
  LocalizedText,
  PHOTO_MAX_EDGE,
  PHOTO_THUMB_EDGE,
  ProfileCardSchema,
  UserPhotoSchema,
  Username,
  VisitSchema,
  Visibility,
  WorkRowSchema,
  type PassportTour,
  type PassportWork,
  type UserPhoto,
} from "@sezi/shared";
import { z } from "zod";

import { errorKey } from "./account";
import type { MessageKey } from "./i18n";
import { browserSupabase } from "./supabase-browser";

const WorkRow = WorkRowSchema.pick({
  slug: true,
  name: true,
  type_slug: true,
  city_slug: true,
  complex_slug: true,
  complex_name: true,
  lng: true,
  lat: true,
});
const TourRow = z.object({
  slug: z.string(),
  title: LocalizedText,
  stops: z.array(z.string()),
});
const BlockRow = z.object({ blocked: z.string().uuid() });
let worksPromise: Promise<PassportWork[]> | undefined;
let toursPromise: Promise<PassportTour[]> | undefined;

export function getWorks(): Promise<PassportWork[]> {
  worksPromise ??= (async () => {
    const { data, error } = await browserSupabase()
      .from("works_view")
      .select(
        "slug,name,type_slug,city_slug,complex_slug,complex_name,lng,lat,location_precision",
      )
      .eq("status", "verified");
    if (error) throw error;
    return z
      .array(WorkRow)
      .parse(data)
      .map(({ lng, lat, ...work }) => ({
        ...work,
        located: lng !== null && lat !== null,
      }));
  })().catch((error: unknown) => {
    worksPromise = undefined;
    throw error;
  });
  return worksPromise;
}
export function getTours(): Promise<PassportTour[]> {
  toursPromise ??= (async () => {
    const { data, error } = await browserSupabase()
      .from("tours_view")
      .select("slug,title,stops")
      .eq("status", "verified");
    if (error) throw error;
    return z.array(TourRow).parse(data);
  })().catch((error: unknown) => {
    toursPromise = undefined;
    throw error;
  });
  return toursPromise;
}
export async function getVisits(uid: string) {
  const { data, error } = await browserSupabase()
    .from("visits")
    .select("work_slug,first_at,method,distance_m")
    .eq("user_id", uid)
    .order("first_at", { ascending: false });
  if (error) throw error;
  return z.array(VisitSchema).parse(data);
}
export async function getContributions(uid: string) {
  const { data, error } = await browserSupabase()
    .from("contributions")
    .select("reports_approved,photos_public,photos_archived,friends")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ? ContributionsSchema.parse(data) : null;
}
export async function getPerson(uid: string) {
  const { data, error } = await browserSupabase()
    .from("profiles")
    .select(
      "user_id,display_name,username,avatar_path,avatar_tone,visibility,findable",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data ? ProfileCardSchema.parse(data) : null;
}
export async function avatarUrl(path: string | null) {
  if (!path) return null;
  const { data, error } = await browserSupabase()
    .storage.from("avatars")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function searchPeople(query: string) {
  const parsed = Username.safeParse(query.trim().toLowerCase());
  if (!parsed.success) return [];
  const { data, error } = await browserSupabase()
    .from("profiles")
    .select(
      "user_id,display_name,username,avatar_path,avatar_tone,visibility,findable",
    )
    .ilike("username", `${parsed.data}%`)
    .limit(10);
  if (error) throw error;
  return z.array(ProfileCardSchema).parse(data);
}
export async function getFriendships() {
  const { data, error } = await browserSupabase()
    .from("friendships")
    .select("id,requester,addressee,status,created_at");
  if (error) throw error;
  return z.array(FriendshipRowSchema).parse(data);
}
export async function getBlocks() {
  const uid = await currentUid();
  const { data, error } = await browserSupabase()
    .from("blocks")
    .select("blocked")
    .eq("blocker", uid);
  if (error) throw error;
  return z.array(BlockRow).parse(data);
}
export async function sendRequest(uid: string) {
  const { error } = await browserSupabase()
    .from("friendships")
    .insert({ addressee: uid });
  if (error) throw error;
}
export async function accept(id: string) {
  const { error } = await browserSupabase()
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", id);
  if (error) throw error;
}
export async function removeFriendship(id: string) {
  const { error } = await browserSupabase()
    .from("friendships")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
export async function block(uid: string) {
  const { error } = await browserSupabase()
    .from("blocks")
    .insert({ blocked: uid });
  if (error) throw error;
}
export async function unblock(uid: string) {
  const me = await currentUid();
  const { error } = await browserSupabase()
    .from("blocks")
    .delete()
    .eq("blocker", me)
    .eq("blocked", uid);
  if (error) throw error;
}
export async function getPhotos({
  uid,
  workSlug,
  community,
}: { uid?: string; workSlug?: string; community?: boolean } = {}) {
  let query = browserSupabase()
    .from("user_photos")
    .select("*")
    .order("created_at", { ascending: false });
  if (uid) query = query.eq("user_id", uid);
  if (workSlug) query = query.eq("work_slug", workSlug);
  if (community)
    query = query.eq("visibility", "public").eq("review", "approved").limit(12);
  const { data, error } = await query;
  if (error) throw error;
  return z.array(UserPhotoSchema).parse(data);
}
export async function getPhoto(id: string) {
  const { data, error } = await browserSupabase()
    .from("user_photos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? UserPhotoSchema.parse(data) : null;
}
export async function photoUrls(
  paths: string[],
): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await browserSupabase()
    .storage.from("user-photos")
    .createSignedUrls(paths, 3600);
  if (error) throw error;
  const rows = z
    .array(
      z.object({
        path: z.string().optional(),
        signedUrl: z.string(),
        error: z.string().nullable().optional(),
      }),
    )
    .parse(data);
  const urls: Record<string, string> = {};
  for (const row of rows)
    if (row.path && !row.error) urls[row.path] = row.signedUrl;
  return urls;
}
async function currentUid() {
  const { data, error } = await browserSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("authentication required");
  return data.user.id;
}
async function encode(bitmap: ImageBitmap, edge: number, quality: number) {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // Projenin tarayıcı hedefi Promise.withResolvers API'sini kapsamıyor.
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("image encode failed")),
      "image/jpeg",
      quality,
    );
  });
  return { blob, width: canvas.width, height: canvas.height };
}
export async function uploadPhoto(input: {
  file: File;
  workSlug: string;
  altText: string;
  caption: string;
  visibility: z.infer<typeof Visibility>;
  suggestArchive: boolean;
}) {
  const uid = await currentUid();
  const id = crypto.randomUUID();
  const path = `${uid}/${id}.jpg`;
  const thumbPath = `${uid}/${id}_t.jpg`;
  const bitmap = await createImageBitmap(input.file, {
    imageOrientation: "from-image",
  });
  const storage = browserSupabase().storage.from("user-photos");
  const uploaded: string[] = [];
  try {
    const full = await encode(bitmap, PHOTO_MAX_EDGE, 0.82);
    const thumb = await encode(bitmap, PHOTO_THUMB_EDGE, 0.75);
    for (const [key, blob] of [
      [path, full.blob],
      [thumbPath, thumb.blob],
    ] satisfies [string, Blob][]) {
      const { error } = await storage.upload(key, blob, {
        contentType: "image/jpeg",
      });
      if (error) throw error;
      uploaded.push(key);
    }
    const row = UserPhotoSchema.pick({
      alt_text: true,
      caption: true,
      visibility: true,
    }).parse({
      alt_text: input.altText,
      caption: input.caption.trim() || null,
      visibility: input.visibility,
    });
    const { error } = await browserSupabase()
      .from("user_photos")
      .insert({
        id,
        user_id: uid,
        work_slug: input.workSlug,
        path,
        thumb_path: thumbPath,
        width: full.width,
        height: full.height,
        ...row,
        taken_at: new Date().toISOString().slice(0, 10),
        archive: input.suggestArchive ? "suggested" : "none",
      });
    if (error) throw error;
  } catch (error) {
    if (uploaded.length) await storage.remove(uploaded);
    throw error;
  } finally {
    bitmap.close();
  }
}
export async function updatePhoto(
  id: string,
  patch: Partial<
    Pick<UserPhoto, "alt_text" | "caption" | "visibility" | "archive">
  >,
) {
  const parsed = UserPhotoSchema.pick({
    alt_text: true,
    caption: true,
    visibility: true,
    archive: true,
  })
    .partial()
    .parse(patch);
  const { error } = await browserSupabase()
    .from("user_photos")
    .update(parsed)
    .eq("id", id);
  if (error) throw error;
}
export async function deletePhoto(photo: UserPhoto) {
  const { error } = await browserSupabase()
    .from("user_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw error;
  const removed = await browserSupabase()
    .storage.from("user-photos")
    .remove([photo.path, photo.thumb_path]);
  if (removed.error) throw removed.error;
}
export function socialErrorKey(error: unknown): MessageKey {
  const message = z.object({ message: z.string() }).safeParse(error);
  return message.success && message.data.message.includes("sınırına")
    ? "photos.err.limit"
    : errorKey(error);
}

export async function getCities() {
  const { data, error } = await browserSupabase()
    .from("cities")
    .select("slug,name");
  if (error) throw error;
  return z.array(CityRowSchema.pick({ slug: true, name: true })).parse(data);
}
