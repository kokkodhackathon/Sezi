import { cn } from "cn";
import { useEffect, useState } from "react";

const NAMES = ["lahmacun", "cay", "nazar", "kahve"] as const;
type FrameName = (typeof NAMES)[number];

type SeziLoaderProps = Omit<React.ComponentProps<"span">, "children"> & {
  label?: string;
};

/** İlk kare lahmacun; mount sonrası rastgele illüstrasyon. */
export function SeziLoader({ className, label, "aria-label": ariaLabel, "aria-hidden": ariaHidden, ...props }: SeziLoaderProps) {
  const [name, setName] = useState<FrameName>("lahmacun");
  useEffect(() => {
    const index = Math.floor(Math.random() * NAMES.length);
    setName(NAMES[index] ?? "lahmacun");
  }, []);

  const hidden = ariaHidden === true || ariaHidden === "true";
  const announced = label ?? (typeof ariaLabel === "string" ? ariaLabel : "Yükleniyor");

  return (
    <span
      {...props}
      aria-hidden={ariaHidden}
      role={hidden ? undefined : "status"}
      className={cn("inline-flex size-4 shrink-0", className)}
    >
      <img
        src={`/loading/${name}.webp`}
        alt=""
        className="size-full animate-spin motion-reduce:animate-none [animation-duration:1.6s]"
      />
      {hidden ? null : <span className="sr-only">{announced}</span>}
    </span>
  );
}
