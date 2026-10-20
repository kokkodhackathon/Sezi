import { Badge } from '@/components/ui/badge';
import { STATUS_LABEL, type Status } from '@/lib/data';

const VARIANT = { verified: 'success', draft: 'warning', archived: 'outline' } as const;

/** İçerik durumu rozeti (eser, fotoğraf, nokta): Doğrulandı / Taslak / Arşivde. */
export function StatusBadge({ status }: { status: Status }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
