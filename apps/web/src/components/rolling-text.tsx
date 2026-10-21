import { cn } from "@/lib/utils";

const DIGITS = "0123456789";

/**
 * Değeri değişince rakamları sayaç gibi kayarak yenilenen metin ("4 dk", "1,2 km"). Rakam olmayan karakterler
 * düz yazılır. Ekran okuyucu yalnız son değeri okur; hareket azaltmada geçiş anlıktır (genel CSS kuralı).
 * Rakam sütunları sağdan anahtarlanır: "9 dk" -> "12 dk" geçişinde birler basamağı yerinde döner.
 */
export function RollingText({ text, className }: { text: string; className?: string }) {
  const chars = [...text];
  return (
    <span className={cn("num inline-flex", className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="inline-flex">
        {chars.map((ch, i) => {
          const key = chars.length - i;
          const d = DIGITS.indexOf(ch);
          if (d < 0) {
            return (
              <span key={`c${key}`} className="whitespace-pre">
                {ch}
              </span>
            );
          }
          return (
            <span key={`d${key}`} className="relative inline-block h-[1lh] overflow-hidden">
              <span className="invisible">0</span>
              <span className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateY(${-d * 10}%)` }}>
                {[...DIGITS].map((n) => (
                  <span key={n} className="h-[1lh]">
                    {n}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
