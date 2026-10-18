import { AUDIO_ACCEPT, type Lang } from '../lib/audio';
import { AUDIO_BASE } from '../lib/supabase';

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
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="label">Ses ({LANG})</span>
      {existing ? (
        <div className="row">
          <audio controls src={AUDIO_BASE + existing} />
          <button type="button" className="btn ghost small" onClick={onRemove}>
            Sesi kaldır
          </button>
        </div>
      ) : null}
      {path && removed && !file ? (
        <span className="muted">
          Kayıtta kaldırılacak.{' '}
          <button type="button" className="btn ghost small" onClick={onUndo}>
            Geri al
          </button>
        </span>
      ) : null}
      <input
        key={`${rev}-${lang}`}
        type="file"
        accept={AUDIO_ACCEPT}
        aria-label={`Ses dosyası seç (${LANG})`}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </div>
  );
}
