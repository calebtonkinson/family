import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-[0.01em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/20 bg-primary/12 text-primary shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.35)] hover:bg-primary/18",
        secondary:
          "border-border/70 bg-secondary/85 text-secondary-foreground hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive/12 text-destructive hover:bg-destructive/18",
        outline: "text-foreground border-border/80 bg-card/70 hover:bg-accent/40",
        warning:
          "border-warning/20 bg-warning/12 text-warning hover:bg-warning/18",
        success:
          "border-success/20 bg-success/12 text-success hover:bg-success/18",
        info:
          "border-info/20 bg-info/12 text-info hover:bg-info/18",
        accent:
          "border-accent/20 bg-accent/12 text-accent hover:bg-accent/18",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
