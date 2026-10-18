import { supabase } from './supabase';

/** Ses kaydı yükleme ve temizliği: Noktalar ve eser sayfası aynı akışı kullanır. */
export type Lang = 'tr' | 'en';
export const LANGS: Lang[] = ['tr', 'en'];
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const AUDIO_ACCEPT = '.mp3,.m4a,.aac,audio/mpeg,audio/mp4,audio/aac';

export const extOf = (f: File) => f.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';

/** Bu kayıtta yüklenenler: kayıt başarısız olursa geri alınır. */
export interface Uploaded {
  lang: Lang;
  assetId: string | null;
  path: string;
}

/** Dosyayı `audio` bucket'ına yükler, `audio_assets` satırını açar ve kimliğini döner. Hatada throw. */
export async function uploadAudio(folder: string, lang: Lang, file: File, label: string, uploaded: Uploaded[]): Promise<string> {
  const path = `${folder}/${lang}-${Date.now()}.${extOf(file)}`;
  const entry: Uploaded = { lang, assetId: null, path };
  const up = await supabase.storage.from('audio').upload(path, file, { contentType: file.type });
  if (up.error) throw up.error;
  uploaded.push(entry);
  const ins = await supabase.from('audio_assets').insert({ storage_path: path, label }).select('id').single();
  if (ins.error) throw ins.error;
  entry.assetId = ins.data.id as string;
  return entry.assetId;
}

/** `audio_assets` satırlarını ve Storage nesnelerini siler. Temizlik başarısızsa true. */
export async function removeAudio(ids: string[], paths: string[]): Promise<boolean> {
  let failed = false;
  if (ids.length) failed = !!(await supabase.from('audio_assets').delete().in('id', ids)).error;
  if (paths.length) failed = !!(await supabase.storage.from('audio').remove(paths)).error || failed;
  return failed;
}
