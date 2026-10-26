import { useId } from "react";

export function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const id = useId();
  const boundedMax = Math.max(0, max);
  const boundedValue = Math.max(0, Math.min(value, boundedMax));
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span id={id}>{label}</span>
        <span className="tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={id}
        aria-valuemin={0}
        aria-valuemax={boundedMax}
        aria-valuenow={boundedValue}
        className="h-2 overflow-hidden rounded-full bg-border"
      >
        <div
          className="h-full bg-primary"
          style={{
            width: `${boundedMax ? (boundedValue / boundedMax) * 100 : 0}%`,
          }}
        />
      </div>
    </div>
  );
}
