import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium tracking-[0.01em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring/70 focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/70 bg-[linear-gradient(180deg,hsl(var(--primary))_0%,hsl(var(--primary)/0.9)_100%)] text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.2),0_14px_28px_-20px_hsl(var(--primary)/0.85)] hover:brightness-105 hover:shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.22),0_18px_32px_-20px_hsl(var(--primary)/0.88)]",
        destructive:
          "border border-destructive/70 bg-[linear-gradient(180deg,hsl(var(--destructive))_0%,hsl(var(--destructive)/0.88)_100%)] text-destructive-foreground shadow-[inset_0_1px_0_hsl(var(--destructive-foreground)/0.18),0_14px_28px_-20px_hsl(var(--destructive)/0.8)] hover:brightness-105 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        success:
          "border border-success/70 bg-[linear-gradient(180deg,hsl(var(--success))_0%,hsl(var(--success)/0.88)_100%)] text-success-foreground shadow-[inset_0_1px_0_hsl(var(--success-foreground)/0.18),0_14px_28px_-20px_hsl(var(--success)/0.8)] hover:brightness-105 focus-visible:ring-success/20",
        warning:
          "border border-warning/70 bg-[linear-gradient(180deg,hsl(var(--warning))_0%,hsl(var(--warning)/0.88)_100%)] text-warning-foreground shadow-[inset_0_1px_0_hsl(var(--warning-foreground)/0.2),0_14px_28px_-20px_hsl(var(--warning)/0.78)] hover:brightness-105 focus-visible:ring-warning/20",
        info:
          "border border-info/70 bg-[linear-gradient(180deg,hsl(var(--info))_0%,hsl(var(--info)/0.9)_100%)] text-info-foreground shadow-[inset_0_1px_0_hsl(var(--info-foreground)/0.18),0_14px_28px_-20px_hsl(var(--info)/0.8)] hover:brightness-105 focus-visible:ring-info/20",
        outline:
          "border border-border/90 bg-card/90 shadow-[inset_0_1px_0_hsl(var(--background)/0.85)] hover:border-primary/40 hover:bg-secondary/60",
        secondary:
          "border border-border/60 bg-secondary/90 text-secondary-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.72)] hover:bg-secondary",
        ghost:
          "hover:bg-accent/10 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline font-medium",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
