import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { Button as EasyButton } from "../easyui/Button";
import { cn } from "@/shared/lib/utils";

export const buttonVariants = cva("inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:shrink-0", {
  variants: {
    variant: { default: "bg-primary text-primary-foreground", destructive: "bg-destructive text-white", outline: "border border-border bg-transparent", secondary: "bg-secondary text-secondary-foreground", ghost: "bg-transparent hover:bg-accent", link: "underline-offset-4 hover:underline" },
    size: { default: "h-9 px-4", xs: "h-6 px-2 text-xs", sm: "h-8 px-3", lg: "h-11 px-5", icon: "size-9 p-0", "icon-xs": "size-6 p-0", "icon-sm": "size-8 p-0", "icon-lg": "size-10 p-0" },
  }, defaultVariants: { variant: "default", size: "default" },
});
type Props = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant = "default", size = "default", asChild, ...props }: Props) {
  const classes = cn(buttonVariants({ variant, size, className }));
  if (asChild) return <Slot.Root data-slot="button" className={classes} {...props}/>;
  return <EasyButton {...props as unknown as ComponentProps<typeof EasyButton>} variant={variant === "default" ? "primary" : variant || "primary"} size={size?.startsWith("icon") ? "icon" : size === "sm" || size === "xs" ? "sm" : size === "lg" ? "lg" : "md"} className={classes} data-slot="button"/>;
}
