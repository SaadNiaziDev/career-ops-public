import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--md-sys-shape-corner-full)] font-medium transition-[background,color,filter] duration-300 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--md-sys-color-primary)] min-h-[40px]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:brightness-110",
        outline:
          "border border-[var(--md-sys-color-outline)] bg-transparent text-[var(--md-sys-color-primary)] hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_8%,transparent)]",
        ghost:
          "bg-transparent text-[var(--md-sys-color-primary)] hover:bg-[color-mix(in_srgb,var(--md-sys-color-primary)_8%,transparent)]",
        secondary:
          "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
        text: "bg-transparent text-[var(--md-sys-color-primary)] min-h-[40px] px-3",
      },
      size: {
        sm: "min-h-[40px] px-3 py-1.5 text-sm",
        icon: "size-10 min-h-[48px] min-w-[48px] p-0",
        default: "px-4 py-2 text-sm",
        hero: "min-h-[56px] px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export type ButtonVariants = VariantProps<typeof buttonVariants>;
