import { cn } from '@/lib/utils';

/**
 * Logodaki kahverengi basamak işaretinin şeffaf izi. Dekoratif (`aria-hidden`).
 * Boyut `className` ile; renk `currentColor` (`text-brand-mark`).
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1169 583" fill="currentColor" aria-hidden className={cn('w-auto', className)}>
      <polygon points="1169 0 872 297 872 96 632 96 632 583 0 583 296 287 296 467 519 467 519 0" />
    </svg>
  );
}
