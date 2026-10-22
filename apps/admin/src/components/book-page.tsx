import { ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

GlobalWorkerOptions.workerSrc = workerUrl;

type Download = { loaded: number; total: number };
type BookLoad = { promise: Promise<PDFDocumentProxy>; progress: Download; listeners: Set<(progress: Download) => void> };
// Aynı cilt için indirme ve PDF ayrıştırma, sayfa ve eser değişimlerinde paylaşılır.
const books = new Map<string, BookLoad>();

function loadBook(url: string): BookLoad {
  const existing = books.get(url);
  if (existing) return existing;
  const entry: BookLoad = { promise: Promise.resolve().then(async () => {
    let cache: Cache | undefined;
    let cached: Response | undefined;
    try {
      cache = await caches.open('sezi-books');
      cached = await cache.match(url);
    } catch {
      // Özel gezinmede veya kota dolduğunda kitap yine ağdan açılabilir.
    }
    let bytes: ArrayBuffer;
    if (cached) {
      bytes = await cached.arrayBuffer();
      notify({ loaded: bytes.byteLength, total: bytes.byteLength });
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Kitap indirilemedi (HTTP ${response.status}).`);
      const total = Number(response.headers.get('content-length')) || 0;
      if (!response.body) throw new Error('Tarayıcı indirme akışını okuyamadı.');
      const reader = response.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let loaded = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.byteLength;
          notify({ loaded, total });
        }
      } finally {
        reader.releaseLock();
      }
      const blob = new Blob(chunks, { type: 'application/pdf' });
      bytes = await blob.arrayBuffer();
      notify({ loaded: bytes.byteLength, total: bytes.byteLength });
      try {
        await cache?.put(url, new Response(blob, { headers: { 'Content-Type': 'application/pdf' } }));
      } catch {
        // Kalıcı önbellek kullanılamasa da bu oturumdaki belge korunur.
      }
    }
    try {
      return await getDocument({ data: bytes }).promise;
    } catch (error) {
      await cache?.delete(url).catch(() => false);
      throw error;
    }
  }), progress: { loaded: 0, total: 0 }, listeners: new Set() };
  function notify(progress: Download) {
    entry.progress = progress;
    for (const listener of entry.listeners) listener(progress);
  }
  books.set(url, entry);
  void entry.promise.catch(() => { if (books.get(url) === entry) books.delete(url); });
  return entry;
}

interface BookPageProps {
  url: string | null;
  pdfPage: number | null;
  printedPage: number;
  pageEnd: number | null;
}

export function BookPage(props: BookPageProps) {
  const [attempt, setAttempt] = useState(0);
  return <BookPageViewer key={`${props.url}:${props.pdfPage}:${attempt}`} {...props} onRetry={() => setAttempt((n) => n + 1)} />;
}

function BookPageViewer({ url, pdfPage, printedPage, pageEnd, onRetry }: BookPageProps & { onRetry: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [progress, setProgress] = useState<Download>(() => (url ? books.get(url)?.progress : undefined) ?? { loaded: 0, total: 0 });
  const [error, setError] = useState('');
  const [page, setPage] = useState(pdfPage ?? 1);
  const [zoom, setZoom] = useState<'fit' | '150'>('fit');
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const entry = loadBook(url);
    entry.listeners.add(setProgress);
    void entry.promise.then((doc) => { if (active) setDocument(doc); }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : 'Kitap açılamadı. İnternet bağlantınızı kontrol edin.');
    });
    return () => { active = false; entry.listeners.delete(setProgress); };
  }, [url]);

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !canvas.current || width <= 0) return;
    const target = canvas.current;
    let active = true;
    let task: RenderTask | undefined;
    void (async () => {
      const sheet = await document.getPage(Math.min(document.numPages, Math.max(1, page)));
      if (!active) return;
      setRendering(true);
      setError('');
      const base = sheet.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? width / base.width : 1.5;
      const viewport = sheet.getViewport({ scale });
      const ratio = window.devicePixelRatio || 1;
      target.width = Math.ceil(viewport.width * ratio);
      target.height = Math.ceil(viewport.height * ratio);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      task = sheet.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
    })().catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : 'Kitap sayfası çizilemedi.');
    }).finally(() => { if (active) setRendering(false); });
    return () => { active = false; task?.cancel(); };
  }, [document, page, zoom, width]);

  const percent = progress.total ? Math.round(progress.loaded / progress.total * 100) : null;
  return (
    <Card className="min-w-0 xl:sticky xl:top-4">
      <CardHeader>
        <CardTitle>Kitap sayfası</CardTitle>
        <CardDescription>
          Basılı s. {printedPage}{pageEnd && pageEnd !== printedPage ? `–${pageEnd}` : ''}
          {pdfPage ? ` · PDF ${pdfPage}` : ' · PDF sayfası bilinmiyor; kitabın başı açıldı.'}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="min-h-12 min-w-12" disabled={!document || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Önceki kitap sayfası"><ChevronLeft /></Button>
          <span className="text-sm" aria-live="polite">PDF {page}{document ? ` / ${document.numPages}` : ''}</span>
          <Button variant="outline" className="min-h-12 min-w-12" disabled={!document || page >= document.numPages} onClick={() => setPage((p) => Math.min(document?.numPages ?? p, p + 1))} aria-label="Sonraki kitap sayfası"><ChevronRight /></Button>
          <Button variant="outline" className="min-h-12" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>Genişliğe sığdır</Button>
          <Button variant="outline" className="min-h-12" aria-pressed={zoom === '150'} onClick={() => setZoom('150')}>%150</Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {!url ? <p className="text-sm text-muted-foreground">Bu taslağın kitap bağlantısı yok.</p> : null}
        {url && !document && !error ? <div className="flex flex-col gap-2" role="status">
          <p className="text-sm">Kitap indiriliyor · {percent === null ? '% hesaplanıyor' : `%${percent}`} · {(progress.loaded / 1_000_000).toFixed(1)}{progress.total ? ` / ${(progress.total / 1_000_000).toFixed(1)}` : ''} MB</p>
          <Progress value={percent} aria-valuenow={percent ?? undefined} aria-label="Kitap indirme ilerlemesi" className="motion-reduce:[&>*]:transition-none" />
          <p className="text-xs text-muted-foreground">İlk açılışta kitabın tamamı indirilir; sonraki açılışlar için bu tarayıcıda saklanır.</p>
        </div> : null}
        {error ? <Alert variant="destructive"><CircleAlert /><AlertTitle>Kitap açılamadı</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" className="min-h-12" onClick={onRetry}>Yeniden dene</Button></AlertDescription></Alert> : null}
        {rendering ? <p role="status" className="flex items-center gap-2 text-sm"><Spinner />Sayfa hazırlanıyor</p> : null}
        <div ref={container} className="min-w-0">
          <div className="max-h-[70vh] overflow-auto xl:max-h-[calc(100vh-310px)]" tabIndex={0} role="region" aria-label="Kitap sayfası; kaydırarak inceleyin">
            <canvas ref={canvas} hidden={!document || rendering || !!error} role="img" aria-label={`Envanter kitabı PDF sayfası ${page}; metni karşıdaki düzenleyiciden okuyabilirsiniz.`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
