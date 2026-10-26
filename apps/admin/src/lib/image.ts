export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function resize(bitmap: ImageBitmap, max: number): Promise<ProcessedImage> {
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Görsel işleme bu tarayıcıda kullanılamıyor.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => b?.type === 'image/webp' ? resolve(b) : reject(new Error('WebP oluşturulamadı.')),
      'image/webp',
      0.82,
    ),
  );
  return { blob, width: canvas.width, height: canvas.height };
}
