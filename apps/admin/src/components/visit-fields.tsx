import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { visitError, type VisitForm } from '@/lib/data';

const TEXT_FIELDS = [
  { key: 'hoursTr', label: 'Ziyaret saatleri (TR)' }, { key: 'hoursEn', label: 'Ziyaret saatleri (EN)' },
  { key: 'noteTr', label: 'Ziyaret notu (TR)' }, { key: 'noteEn', label: 'Ziyaret notu (EN)' },
] satisfies { key: keyof VisitForm; label: string }[];
export function VisitFields({ value, onChange }: { value: VisitForm; onChange: (v: VisitForm) => void }) {
  function update(key: keyof VisitForm, next: string) {
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    onChange({ ...value, [key]: next, ...(key !== 'checkedOn' && next.trim() && !value.checkedOn ? { checkedOn: today } : {}) });
  }
  const error = visitError(value);
  return <FieldSet><FieldLegend>Gitmeden önce</FieldLegend><FieldDescription>Sahada veya resmî kaynaktan doğrulayın. Bilgi girildiğinde kaynak ve kontrol tarihi zorunludur.</FieldDescription><FieldGroup>
    <Field><FieldLabel htmlFor="visit-steps">Girişteki basamak sayısı (0 = basamaksız)</FieldLabel><Input id="visit-steps" className="min-h-12" type="number" min={0} max={200} step={1} value={value.steps} onChange={(e) => update('steps', e.target.value)} /></Field>
    <Field><FieldLabel htmlFor="visit-ramp">Rampa</FieldLabel><select id="visit-ramp" className="min-h-12 rounded-md border bg-background px-3" value={value.ramp} onChange={(e) => update('ramp', e.target.value)}><option value="">Bilinmiyor</option><option value="yes">Var</option><option value="no">Yok</option></select></Field>
    <Field><FieldLabel htmlFor="visit-minutes">Ortalama gezme süresi (dakika)</FieldLabel><Input id="visit-minutes" className="min-h-12" type="number" min={1} max={600} step={1} value={value.minutes} onChange={(e) => update('minutes', e.target.value)} /></Field>
    {TEXT_FIELDS.map(({ key, label }) => <Field key={key}><FieldLabel htmlFor={`visit-${key}`}>{label}</FieldLabel><Textarea id={`visit-${key}`} value={value[key]} onChange={(e) => update(key, e.target.value)} /></Field>)}
    <Field data-invalid={Boolean(error) || undefined}><FieldLabel htmlFor="visit-source">Kaynak</FieldLabel><Input id="visit-source" className="min-h-12" value={value.source} placeholder="Sezi saha gözlemi veya kaynak URL'si" aria-invalid={Boolean(error) || undefined} onChange={(e) => update('source', e.target.value)} /></Field>
    <Field><FieldLabel htmlFor="visit-checked">Kontrol tarihi</FieldLabel><Input id="visit-checked" className="min-h-12" type="date" value={value.checkedOn} onChange={(e) => update('checkedOn', e.target.value)} /></Field>
    {error ? <FieldDescription role="alert">{error}</FieldDescription> : null}
  </FieldGroup></FieldSet>;
}
