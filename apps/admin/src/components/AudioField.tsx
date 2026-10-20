import { RotateCcw, Trash2, Volume2, X } from 'lucide-react';
import { useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AUDIO_ACCEPT, type Lang } from '@/lib/audio';
import { AUDIO_BASE } from '@/lib/supabase';

const LANG_NAME: Record<Lang, string> = { tr: 'Türkçe (TR)', en: 'İngilizce (EN)' };

/** Tek dil için ses kaydı: mevcut kaydı dinle/kaldır, yeni dosya seç. */
export function AudioField({
  lang,
  path,
  file,
  removed,
  rev,
  onRemove,
  onUndo,
  onPick,
}: {
  lang: Lang;
  /** Kayıtlı dosyanın Storage yolu. */
  path: string | null | undefined;
  /** Yeni seçilen dosya. */
  file: File | undefined;
  /** Mevcut kayıt kayıtta kaldırılacak. */
  removed: boolean;
  /** Değişince dosya alanı sıfırlanır. */
  rev: number;
  onRemove: () => void;
  onUndo: () => void;
  onPick: (f: File | undefined) => void;
}) {
  const LANG = lang.toUpperCase();
  const existing = path && !removed && !file ? path : null;
  const [localRev, setLocalRev] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputId = `audio-file-${lang}`;

  const handleFileChange = (selected: File | undefined) => {
    if (selected && path && !removed) {
      setPendingFile(selected);
      return;
    }
    onPick(selected);
  };

  const clearSelectedFile = () => {
    setLocalRev((r) => r + 1);
    onPick(undefined);
  };

  return (
    <Field className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel htmlFor={inputId} className="flex items-center gap-1.5">
          <Volume2 className="size-4 text-muted-foreground" aria-hidden />
          Ses ({LANG_NAME[lang]})
        </FieldLabel>
        {existing ? <Badge variant="success">Kayıt yüklü</Badge> : null}
        {path && removed && !file ? <Badge variant="warning">Kayıtta kaldırılacak</Badge> : null}
        {file ? <Badge variant="secondary">Yeni dosya seçildi</Badge> : null}
      </div>

      {existing ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <audio controls src={AUDIO_BASE + existing} className="h-9 min-w-0 flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Trash2 data-icon="inline-start" />
                Sesi kaldır
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ses kaydı kaldırılsın mı?</AlertDialogTitle>
                <AlertDialogDescription>
                  {LANG_NAME[lang]} ses kaydı formu kaydettiğinizde silinecek. Kaydetmeden önce işlemi geri alabilirsiniz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onRemove}>
                  Sesi kaldır
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {path && removed && !file ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning/40 px-2.5 py-1.5 text-sm text-warning-foreground">
          <span>Mevcut ses kaydı kaydedildiğinde silinecek.</span>
          <Button type="button" variant="ghost" size="xs" onClick={onUndo}>
            <RotateCcw data-icon="inline-start" />
            Geri al
          </Button>
        </div>
      ) : null}

      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/60 px-2.5 py-1.5 text-sm">
          <span className="truncate font-medium">
            {file.name} <span className="text-muted-foreground num">({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </span>
          <Button type="button" variant="ghost" size="xs" onClick={clearSelectedFile}>
            <X data-icon="inline-start" />
            Seçimi kaldır
          </Button>
        </div>
      ) : null}

      <Input
        id={inputId}
        key={`${rev}-${lang}-${localRev}`}
        type="file"
        accept={AUDIO_ACCEPT}
        aria-label={`Ses dosyası seç (${LANG})`}
        onChange={(e) => handleFileChange(e.target.files?.[0])}
      />
      <FieldDescription>MP3, M4A, WAV, OGG veya AAC · En fazla 10 MB</FieldDescription>

      <AlertDialog
        open={pendingFile !== null}
        onOpenChange={(open) => {
          if (!open && pendingFile) {
            setPendingFile(null);
            setLocalRev((r) => r + 1);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mevcut ses kaydı değiştirilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Seçtiğiniz <strong>{pendingFile?.name}</strong> dosyası kaydedildiğinde mevcut {LANG_NAME[lang]} ses kaydının yerini alacak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFile) onPick(pendingFile);
                setPendingFile(null);
              }}>
              Değiştir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Field>
  );
}
