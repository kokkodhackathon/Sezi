import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { tr } from '@/lib/data';
import { resize, type ProcessedImage } from '@/lib/image';
import { supabase } from '@/lib/supabase';

const WorkSchema = z.object({ id: z.string().uuid(), slug: z.string(), name: z.object({ tr: z.string(), en: z.string().optional() }) });
const KindSchema = z.enum(['photo', 'aerial', 'inscription']);
const LICENSES = ['Sezi ekibi çekimi', 'Telif sahibinin yazılı izniyle', 'CC BY 4.0', 'CC BY-SA 4.0', 'CC0', 'Kamu malı', 'Diğer'];
const LICENSE_URLS: Record<string, string> = {
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
  CC0: 'https://creativecommons.org/publicdomain/zero/1.0/',
};
interface Photo {
  id: string; file: File; preview: string; kind: z.infer<typeof KindSchema>;
  altTr: string; altEn: string; author: string; license: string; otherLicense: string;
  licenseUrl: string; sourceUrl: string; published: boolean; status: string; done: boolean;
}

function errorMessage(error: unknown) {
  const parsed = z.object({ message: z.string() }).safeParse(error);
  return parsed.success ? parsed.data.message : 'Yükleme başarısız.';
}

export function PhotoUpload() {
  const [params] = useSearchParams();
  const requested = params.get('work') ?? '';
  const [selectedSlug, setSelectedSlug] = useState(requested);
  const [search, setSearch] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const previews = useRef<string[]>([]);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const works = useQuery({
    queryKey: ['upload-works', 'bursa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('works_view').select('id, slug, name').eq('city_slug', 'bursa').order('slug');
      if (error) throw error;
      return z.array(WorkSchema).parse(data);
    },
  });
  useEffect(() => () => { for (const url of previews.current) URL.revokeObjectURL(url); }, []);
  const work = works.data?.find((w) => w.slug === selectedSlug);
  const patch = (id: string, values: Partial<Photo>) => setPhotos((rows) => rows.map((p) => p.id === id ? { ...p, ...values } : p));
  function addFiles(files: File[]) {
    const added: Photo[] = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name}: Görsel dosyası seçin.`); continue; }
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      added.push({ id: crypto.randomUUID(), file, preview, kind: 'photo', altTr: '', altEn: '', author: '', license: '', otherLicense: '', licenseUrl: '', sourceUrl: '', published: false, status: 'Hazır', done: false });
    }
    setPhotos((rows) => [...rows, ...added]);
  }
  async function upload() {
    if (!work || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from('media').select('sort_order').eq('work_id', work.id).order('sort_order', { ascending: false }).limit(1);
      if (error) throw error;
      let order = (z.array(z.object({ sort_order: z.number() })).parse(data)[0]?.sort_order ?? -1) + 1;
      for (const photo of photos.filter((p) => !p.done)) {
        const paths: string[] = [];
        const toastId = toast.loading(`${photo.file.name}: Hazırlanıyor…`);
        try {
          const license = photo.license === 'Diğer' ? photo.otherLicense.trim() : photo.license;
          if (!photo.altTr.trim() || !photo.author.trim() || !license) throw new Error('TR açıklama, fotoğrafçı / kaynak ve kullanım izni zorunludur.');
          for (const url of [photo.sourceUrl, photo.licenseUrl]) if (url.trim() && !z.string().url().regex(/^https?:\/\//i).safeParse(url.trim()).success) throw new Error('Bağlantıları tam HTTP(S) adresi olarak girin (https://…).');
          patch(photo.id, { status: 'Görsel işleniyor…' });
          const bitmap = await createImageBitmap(photo.file, { imageOrientation: 'from-image' });
          let full: ProcessedImage;
          let thumb: ProcessedImage;
          try { full = await resize(bitmap, 1600); thumb = await resize(bitmap, 480); } finally { bitmap.close(); }
          const base = `uploads/${work.slug}/${crypto.randomUUID()}`;
          const fullPath = `${base}.webp`;
          const thumbPath = `${base}_t.webp`;
          patch(photo.id, { status: 'Büyük görsel yükleniyor (1/3)…' });
          for (const [path, blob] of [[fullPath, full.blob], [thumbPath, thumb.blob]] satisfies [string, Blob][]) {
            const result = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/webp', upsert: false });
            if (result.error) throw result.error;
            paths.push(path);
            patch(photo.id, { status: path === fullPath ? 'Küçük görsel yükleniyor (2/3)…' : 'Fotoğraf kaydediliyor (3/3)…' });
          }
          const result = await supabase.from('media').insert({ work_id: work.id, origin: 'upload', kind: photo.kind, storage_path: fullPath, thumb_path: thumbPath,
            width: full.width, height: full.height, sort_order: order++, status: photo.published ? 'verified' : 'draft',
            alt_text: { tr: photo.altTr.trim(), ...(photo.altEn.trim() ? { en: photo.altEn.trim() } : {}) }, author: photo.author.trim(), license,
            license_url: photo.licenseUrl.trim() || null, source_url: photo.sourceUrl.trim() || null,
            modifications: { tr: "Küçültüldü, WebP'ye dönüştürüldü", en: 'Resized, converted to WebP' } });
          if (result.error) throw result.error;
          patch(photo.id, { status: photo.published ? 'Yayımlandı' : 'Taslak kaydedildi', done: true });
          toast.success(`${photo.file.name}: ${photo.published ? 'Yayımlandı' : 'Taslak kaydedildi'}`, { id: toastId });
          for (const key of [['work', work.slug], ['works'], ['dashboard'], ['inbox']]) void qc.invalidateQueries({ queryKey: key });
        } catch (err) {
          let message = errorMessage(err);
          if (paths.length) {
            const cleanup = await supabase.storage.from('media').remove(paths);
            if (cleanup.error) message += ` Yüklenen dosyalar temizlenemedi: ${cleanup.error.message}`;
          }
          patch(photo.id, { status: message });
          toast.error(`${photo.file.name}: ${message}`, { id: toastId });
        }
      }
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <Card>
    <CardHeader><CardTitle>Fotoğraf yükle</CardTitle><CardDescription>Bursa eserine kendi fotoğrafınızı ekleyin. Açıklama ve kullanım izni her fotoğraf için ayrı kaydedilir.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-6">
      <FieldGroup>
        <Field><FieldLabel htmlFor="upload-work-search">Bursa eserlerinde ara</FieldLabel><Input id="upload-work-search" className="min-h-12" value={search} disabled={busy} onChange={(e) => setSearch(e.target.value)} placeholder="Eser adı" /></Field>
        <Field><FieldLabel htmlFor="upload-work">Eser *</FieldLabel><select id="upload-work" className="min-h-12 w-full rounded-md border bg-background px-3" disabled={busy || works.isLoading} value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}><option value="">Eser seçin</option>{works.data?.filter((w) => w.slug === selectedSlug || tr(w.name).toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr'))).map((w) => <option key={w.id} value={w.slug}>{tr(w.name)}</option>)}</select>{works.error ? <FieldDescription role="alert">{works.error.message}</FieldDescription> : null}</Field>
        <Field onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!busy) addFiles(Array.from(e.dataTransfer.files)); }} className="rounded-lg border border-dashed p-6">
          <FieldLabel htmlFor="upload-files">Fotoğrafları buraya sürükleyin veya dosya seçin</FieldLabel><Input id="upload-files" type="file" accept="image/*" multiple disabled={busy} className="min-h-12" onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} /><FieldDescription>Görseller en fazla 1600 piksel, önizlemeler 480 piksel olarak WebP biçiminde kaydedilir.</FieldDescription>
        </Field>
      </FieldGroup>
      {photos.map((photo) => <Card key={photo.id}><CardHeader><CardTitle className="break-all">{photo.file.name}</CardTitle><CardDescription role="status" aria-live="polite">{photo.status}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">
        <img src={photo.preview} alt={photo.altTr || 'Yüklenecek fotoğrafın önizlemesi'} className="max-h-64 w-full rounded-lg object-contain" />
        <fieldset disabled={busy || photo.done}><FieldGroup>
          <Field><FieldLabel htmlFor={`${photo.id}-kind`}>Tür</FieldLabel><select id={`${photo.id}-kind`} className="min-h-12 rounded-md border bg-background px-3" value={photo.kind} onChange={(e) => patch(photo.id, { kind: KindSchema.parse(e.target.value) })}><option value="photo">Fotoğraf</option><option value="aerial">Havadan görünüm</option><option value="inscription">Kitabe</option></select></Field>
          {(['altTr', 'altEn', 'author', 'licenseUrl', 'sourceUrl'] satisfies (keyof Photo)[]).map((key) => <Field key={key}><FieldLabel htmlFor={`${photo.id}-${key}`}>{{ altTr: 'Açıklama / alt metin (TR) *', altEn: 'Açıklama / alt metin (EN, isteğe bağlı)', author: 'Fotoğrafçı / kaynak *', licenseUrl: 'Lisans bağlantısı', sourceUrl: 'Kaynak adresi' }[key]}</FieldLabel>{key === 'altTr' || key === 'altEn' ? <Textarea id={`${photo.id}-${key}`} value={photo[key]} required={key === 'altTr'} onChange={(e) => patch(photo.id, { [key]: e.target.value })} /> : <Input id={`${photo.id}-${key}`} className="min-h-12" type={key.endsWith('Url') ? 'url' : 'text'} value={photo[key]} required={key === 'author'} onChange={(e) => patch(photo.id, { [key]: e.target.value })} />}</Field>)}
          <Field><FieldLabel htmlFor={`${photo.id}-license`}>Kullanım izni *</FieldLabel><select id={`${photo.id}-license`} className="min-h-12 rounded-md border bg-background px-3" value={photo.license} required onChange={(e) => patch(photo.id, { license: e.target.value, licenseUrl: LICENSE_URLS[e.target.value] ?? '' })}><option value="">İzin seçin</option>{LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}</select></Field>
          {photo.license === 'Diğer' ? <Field><FieldLabel htmlFor={`${photo.id}-other`}>Kullanım iznini açıklayın *</FieldLabel><Input id={`${photo.id}-other`} className="min-h-12" value={photo.otherLicense} onChange={(e) => patch(photo.id, { otherLicense: e.target.value })} required /></Field> : null}
          <Field><FieldLabel htmlFor={`${photo.id}-publish`}>Yayın durumu</FieldLabel><select id={`${photo.id}-publish`} className="min-h-12 rounded-md border bg-background px-3" value={photo.published ? 'verified' : 'draft'} onChange={(e) => patch(photo.id, { published: e.target.value === 'verified' })}><option value="draft">Taslak</option><option value="verified">Hemen yayınla</option></select></Field>
        </FieldGroup></fieldset>
        <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={() => { URL.revokeObjectURL(photo.preview); setPhotos((rows) => rows.filter((p) => p.id !== photo.id)); }}>Listeden kaldır</Button>
      </CardContent></Card>)}
      <Button type="button" className="min-h-12 self-start" disabled={busy || !work || !photos.some((p) => !p.done)} onClick={() => void upload()}>{busy ? 'Yükleniyor…' : 'Fotoğrafları yükle'}</Button>
    </CardContent>
  </Card>;
}
