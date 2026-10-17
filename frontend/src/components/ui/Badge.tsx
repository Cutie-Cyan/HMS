import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "info";

const toneStyles: Record<Tone, string> = {
  neutral: "border-transparent bg-secondary text-secondary-foreground",
  success: "border-transparent bg-emerald-50 text-emerald-700",
  warning: "border-transparent bg-amber-50 text-amber-800",
  info: "border-transparent bg-sky-50 text-sky-700",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      data-slot="badge"
      className={`inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${toneStyles[tone]} ${className}`}
      {...props}
    />
  );
}
