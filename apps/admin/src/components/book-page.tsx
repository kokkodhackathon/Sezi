import { ChevronLeft, ChevronRight, CircleAlert, Maximize2, Minimize2, Minus, Plus, ScanLine } from 'lucide-react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

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

/** Çift sayfa (yayıncının PDF'i iki kitap sayfasını tek PDF sayfasında veriyor) ya da yalnız bir yarısı. */
type View = 'spread' | 'left' | 'right';
const VIEW_KEY = 'sezi-book-view';
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const savedView = (): View => {
  const v = localStorage.getItem(VIEW_KEY);
  // Envanter kitabında kaydın ilk PDF sayfası solda fotoğraf, sağda metin: varsayılan sağ sayfa.
  return v === 'left' || v === 'right' || v === 'spread' ? v : 'right';
};

/**
 * Kopyalanan metni düzenleyiciye yapıştırılabilir hâle getirir: satır sonları birleşir, satır sonunda bölünen
 * sözcük tamamlanır. Bursa ciltlerinin gömülü yazı tipi PDF.js'te "ş/Ş" harfini "!", "İ" harfini "%" olarak
 * veriyor (ör. "in!a", "!ehrin"; veri hattındaki `fix_glyphs` ile aynı düzeltme). Sözcük başındaki "!" yalnız
 * seçimin ya da cümlenin başındaysa büyük "Ş" sayılır (satır başı cümle başı değildir).
 */
function cleanCopied(text: string, bursa: boolean): string {
  let s = text.replace(/\r/g, '').replace(/\u00ad/g, '').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl');
  if (bursa) {
    s = s
      .replace(/%/g, 'İ')
      .replace(/(^|[.?…]\s+)!(?=\p{Ll})/gu, '$1Ş')
      .replace(/(?<=\p{L})!|!(?=\p{L})/gu, 'ş');
  }
  return s
    .replace(/-\n(?=\p{Ll})/gu, '')
    .replace(/([^\n])\n(?!\n)/g, '$1 ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function BookPageViewer({ url, pdfPage, printedPage, pageEnd, onRetry }: BookPageProps & { onRetry: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [progress, setProgress] = useState<Download>(() => (url ? books.get(url)?.progress : undefined) ?? { loaded: 0, total: 0 });
  const [error, setError] = useState('');
  const [page, setPage] = useState(pdfPage ?? 1);
  const [pageInput, setPageInput] = useState(String(pdfPage ?? 1));
  const [view, setView] = useState<View>(savedView);
  const [spread, setSpread] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const sheetBox = useRef<HTMLDivElement>(null);

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
    const node = scroller.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(window.document.fullscreenElement === frame.current);
    window.document.addEventListener('fullscreenchange', onChange);
    return () => window.document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!document || !canvas.current || !text.current || !sheetBox.current || width <= 0) return;
    const target = canvas.current;
    const layer = text.current;
    const box = sheetBox.current;
    let active = true;
    let task: RenderTask | undefined;
    let textLayer: TextLayer | undefined;
    void (async () => {
      const sheet = await document.getPage(Math.min(document.numPages, Math.max(1, page)));
      if (!active) return;
      setRendering(true);
      setError('');
      const base = sheet.getViewport({ scale: 1 });
      const isSpread = base.width > base.height * 1.15;
      setSpread(isSpread);
      const half = isSpread && view !== 'spread';
      // Kenar boşluğu (her yanda 16 px) düşülerek genişliğe sığdırılır; yarım görünümde tek kitap sayfası sığar.
      const fit = (width - 32) / (half ? base.width / 2 : base.width);
      const viewport = sheet.getViewport({ scale: fit * zoom });
      const ratio = window.devicePixelRatio || 1;
      const draw = window.document.createElement('canvas');
      draw.width = Math.ceil(viewport.width * ratio);
      draw.height = Math.ceil(viewport.height * ratio);
      task = sheet.render({ canvas: draw, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (!active) return;
      // Çizim bitince bir kerede değiştirilir: sayfa değişirken eski sayfa boş kalmaz.
      target.width = draw.width;
      target.height = draw.height;
      target.getContext('2d')?.drawImage(draw, 0, 0);
      box.style.width = `${viewport.width}px`;
      box.style.height = `${viewport.height}px`;
      layer.replaceChildren();
      layer.style.setProperty('--scale-factor', String(viewport.scale));
      layer.style.setProperty('--total-scale-factor', String(viewport.scale));
      textLayer = new TextLayer({ textContentSource: sheet.streamTextContent(), container: layer, viewport });
      await textLayer.render();
      if (!active) return;
      setRendered(true);
      const scroll = scroller.current;
      if (scroll) scroll.scrollTo({ top: 0, left: half && view === 'right' ? scroll.scrollWidth : 0 });
    })().catch((e: unknown) => {
      if (active && !(e instanceof Error && e.name === 'RenderingCancelledException')) setError(e instanceof Error ? e.message : 'Kitap sayfası çizilemedi.');
    }).finally(() => { if (active) setRendering(false); });
    return () => { active = false; task?.cancel(); textLayer?.cancel(); };
  }, [document, page, view, zoom, width, fullscreen]);

  const total = document?.numPages ?? 0;
  const goTo = (n: number) => {
    if (!document) return;
    const next = Math.min(total, Math.max(1, Math.round(n)));
    setPage(next);
    setPageInput(String(next));
  };
  const chooseView = (v: string) => {
    if (v !== 'spread' && v !== 'left' && v !== 'right') return;
    setView(v);
    setZoom(1);
    localStorage.setItem(VIEW_KEY, v);
  };
  const step = (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
  const toggleFullscreen = () => {
    if (window.document.fullscreenElement) void window.document.exitFullscreen();
    else void frame.current?.requestFullscreen();
  };
  // Kısayollar yalnız kitap alanının kendisi odaktayken ve değiştirici tuş yokken: Shift+ok metin seçimi,
  // araç çubuğundaki düğme/geçiş okları ve PageUp/PageDown kaydırması doğal kalır.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); goTo(page + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(page - 1); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); step(0.25); }
    else if (e.key === '-') { e.preventDefault(); step(-0.25); }
    else if (e.key === '0') { e.preventDefault(); setZoom(1); }
  };
  const onCopy = (e: ClipboardEvent<HTMLDivElement>) => {
    const selected = window.getSelection()?.toString();
    if (!selected) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', cleanCopied(selected, !!url && /bursa/i.test(url)));
  };

  const percent = progress.total ? Math.round(progress.loaded / progress.total * 100) : null;
  const record = `Basılı s. ${printedPage}${pageEnd && pageEnd !== printedPage ? `–${pageEnd}` : ''}`;
  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0 xl:sticky xl:top-4">
      <div ref={frame} className="flex min-w-0 flex-col bg-card">
        {/* Araç çubuğu: sayfa, görünüm, yakınlık, tam ekran. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-10" disabled={!document || page <= 1} onClick={() => goTo(page - 1)} aria-label="Önceki PDF sayfası (←)"><ChevronLeft /></Button>
            <form className="flex items-center gap-1 text-sm" onSubmit={(e) => { e.preventDefault(); goTo(Number(pageInput) || page); }}>
              <Input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                onBlur={() => goTo(Number(pageInput) || page)}
                inputMode="numeric"
                aria-label="PDF sayfa numarası"
                className="h-10 w-14 text-center tabular-nums"
                disabled={!document}
              />
              <span className="tabular-nums text-muted-foreground">/ {total || '–'}</span>
            </form>
            <Button variant="ghost" size="icon" className="size-10" disabled={!document || page >= total} onClick={() => goTo(page + 1)} aria-label="Sonraki PDF sayfası (→)"><ChevronRight /></Button>
          </div>

          {spread ? (
            <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={chooseView} aria-label="Görünüm">
              <ToggleGroupItem value="left" className="h-10 px-3">Sol sayfa</ToggleGroupItem>
              <ToggleGroupItem value="spread" className="h-10 px-3">Çift</ToggleGroupItem>
              <ToggleGroupItem value="right" className="h-10 px-3">Sağ sayfa</ToggleGroupItem>
            </ToggleGroup>
          ) : null}

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-10" disabled={zoom <= ZOOM_MIN} onClick={() => step(-0.25)} aria-label="Uzaklaştır (−)"><Minus /></Button>
            <Button variant="ghost" className="h-10 min-w-16 tabular-nums" onClick={() => setZoom(1)} aria-label={`Yakınlık %${Math.round(zoom * 100)}; genişliğe sığdır (0)`} title="Genişliğe sığdır (0)">
              %{Math.round(zoom * 100)}
            </Button>
            <Button variant="ghost" size="icon" className="size-10" disabled={zoom >= ZOOM_MAX} onClick={() => step(0.25)} aria-label="Yakınlaştır (+)"><Plus /></Button>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {pdfPage && page !== pdfPage ? (
              <Button variant="ghost" className="h-10" onClick={() => goTo(pdfPage)}><ScanLine data-icon="inline-start" />Kaydın başı</Button>
            ) : null}
            <Button variant="ghost" size="icon" className="size-10" onClick={toggleFullscreen} aria-label={fullscreen ? 'Tam ekrandan çık (Esc)' : 'Tam ekran'}>
              {fullscreen ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </div>
        </div>

        <p className="border-b px-4 py-1.5 text-xs text-muted-foreground">
          {record}{pdfPage ? ` · kayıt PDF ${pdfPage}. sayfada başlıyor` : ' · PDF sayfası bilinmiyor; kitabın başı açıldı'} · Metni seçip kopyalayabilirsiniz
        </p>

        {!url ? <p className="p-4 text-sm text-muted-foreground">Bu taslağın kitap bağlantısı yok.</p> : null}
        {url && !document && !error ? (
          <div className="flex flex-col gap-2 p-4" role="status">
            <p className="text-sm">Kitap indiriliyor · {percent === null ? '% hesaplanıyor' : `%${percent}`} · {(progress.loaded / 1_000_000).toFixed(1)}{progress.total ? ` / ${(progress.total / 1_000_000).toFixed(1)}` : ''} MB</p>
            <Progress value={percent} aria-valuenow={percent ?? undefined} aria-label="Kitap indirme ilerlemesi" className="motion-reduce:[&>*]:transition-none" />
            <p className="text-xs text-muted-foreground">İlk açılışta kitabın tamamı indirilir; sonraki açılışlar için bu tarayıcıda saklanır.</p>
          </div>
        ) : null}
        {error ? (
          <div className="p-4">
            <Alert variant="destructive"><CircleAlert /><AlertTitle>Kitap açılamadı</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" className="min-h-12" onClick={onRetry}>Yeniden dene</Button></AlertDescription></Alert>
          </div>
        ) : null}

        {/* Sayfa: gri zemin üstünde kâğıt; görüntü (canvas) + seçilebilir metin katmanı. */}
        <div
          ref={scroller}
          className={fullscreen ? 'relative h-[calc(100vh-92px)] overflow-auto bg-muted' : 'relative h-[calc(100vh-200px)] min-h-[420px] overflow-auto bg-muted'}
          tabIndex={0}
          role="region"
          aria-label={`Envanter kitabı, PDF sayfası ${page}. Metin seçilebilir; ← → ile sayfa değişir.`}
          onKeyDown={onKey}
          onCopy={onCopy}>
          <div className="flex min-h-full w-max min-w-full justify-center p-4">
            <div ref={sheetBox} className="relative shrink-0 bg-white shadow-sm ring-1 ring-border" hidden={!rendered}>
              <canvas ref={canvas} className="absolute inset-0 size-full" aria-hidden />
              <div ref={text} className="textLayer" />
            </div>
          </div>
          {rendering && rendered ? (
            <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-md bg-background/90 px-2 py-1 text-xs shadow-sm" role="status"><Spinner />Sayfa hazırlanıyor</div>
          ) : null}
          {rendering && !rendered && document ? (
            <div className="flex items-center gap-2 p-4 text-sm" role="status"><Spinner />Sayfa hazırlanıyor</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
