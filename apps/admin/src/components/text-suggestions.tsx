import { moveToArchitecture, paragraphsOf, suggestArchitecture, suggestBuiltYears, type SuggestLang } from '@sezi/shared';
import { ArrowDownToLine, CalendarSearch, Columns2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * Tarihçe metninde mimari bölüm önerisi: önerilen paragraflar işaretli gelir, admin kitapla karşılaştırıp
 * işaretleri düzeltir ve Mimari alanına taşır. Form kaydedilene kadar hiçbir şey veritabanına yazılmaz.
 * Tarihçe metni herhangi bir şekilde değişince (aynı uzunlukta düzenleme, paragraf bölme, taşıma) seçim yeni
 * metnin önerisinden yeniden kurulur: eski paragraf numaraları başka paragrafları göstermesin.
 */
export function ArchitectureSuggest({ history, architecture, lang, disabled, onApply }: {
  history: string;
  architecture: string;
  lang: SuggestLang;
  disabled: boolean;
  onApply: (next: { history: string; architecture: string }) => void;
}) {
  const paragraphs = useMemo(() => paragraphsOf(history), [history]);
  const suggestion = useMemo(() => suggestArchitecture(paragraphs, lang), [paragraphs, lang]);
  const initial = () => {
    const s = new Set<number>();
    if (suggestion) for (let i = suggestion.start; i < suggestion.end; i++) s.add(i);
    return s;
  };
  const [picked, setPicked] = useState<Set<number>>(initial);
  const [pickedFor, setPickedFor] = useState(history);
  // Render sırasında eşitlenir (efektte değil): değişen metinle eski seçim bir kare bile görünmez.
  if (pickedFor !== history) {
    setPickedFor(history);
    setPicked(initial());
  }
  // Mimari zaten ayrılmışsa öneri yalnız gürültüdür (sonradan taşınan paragraf kitap sırasını bozar).
  if (!suggestion || architecture.trim()) return null;
  const toggle = (i: number, on: boolean) => {
    const next = new Set(picked);
    if (on) next.add(i);
    else next.delete(i);
    setPicked(next);
  };
  const label = lang === 'tr' ? 'TR' : 'EN';
  return (
    <Alert>
      <Columns2 />
      <AlertTitle>Mimari bölüm önerisi ({label})</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>
          Kitapta mimari tanım genelde tarihçenin ortasında tek blok halindedir. İşaretli paragraflar tahmindir: kitapla
          karşılaştırıp düzeltin, sonra Mimari alanına taşıyın. Kaydetmeden yayına girmez.
        </p>
        <ol className="flex max-h-96 flex-col gap-1 overflow-y-auto rounded-md border p-1" aria-label={`Tarihçe paragrafları (${label})`}>
          {paragraphs.map((p, i) => {
            const id = `arch-pick-${lang}-${i}`;
            return (
              <li key={id}>
                <label htmlFor={id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted has-data-checked:bg-muted">
                  <Checkbox id={id} className="mt-0.5" checked={picked.has(i)} disabled={disabled} onCheckedChange={(v) => toggle(i, v === true)} />
                  <span className="num w-6 shrink-0 text-muted-foreground">{i + 1}.</span>
                  <span className="line-clamp-2 text-foreground" lang={lang}>{p}</span>
                </label>
              </li>
            );
          })}
        </ol>
        <Button
          variant="outline"
          size="sm"
          className="min-h-10 self-start"
          disabled={disabled || picked.size === 0}
          onClick={() => onApply(moveToArchitecture(history, architecture, picked))}
        >
          <ArrowDownToLine data-icon="inline-start" />
          {picked.size} paragrafı Mimari'ye taşı
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** Kitap metninden yapım yılı önerileri; her öneri kanıt cümlesiyle gelir, tıklanınca alana yazılır. */
export function BuiltYearSuggest({ text, current, disabled, onPick }: {
  text: string;
  current: string;
  disabled: boolean;
  onPick: (year: number) => void;
}) {
  const suggestions = useMemo(() => suggestBuiltYears(text), [text]);
  if (suggestions.length === 0) return null;
  return (
    <Alert>
      <CalendarSearch />
      <AlertTitle>Metinde geçen yapım tarihleri</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>Cümleyi okuyup doğruysa yılı seçin; yapım tarihi kesin değilse (ör. “…’den önce”) boş bırakın.</p>
        <ul className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <li key={s.year} className="flex flex-wrap items-start gap-3">
              <Button
                variant={current === String(s.year) ? 'secondary' : 'outline'}
                size="sm"
                className="num min-h-10 min-w-16"
                disabled={disabled}
                aria-pressed={current === String(s.year)}
                onClick={() => onPick(s.year)}
              >
                {s.year}
              </Button>
              <q className="min-w-0 flex-1 text-foreground" lang="tr">{s.sentence}</q>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
