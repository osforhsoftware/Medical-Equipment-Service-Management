import { cn } from "@/lib/utils";

/** Brand mark served from /public/MESMS.svg */
const sizeClasses = {
  xs: "h-7 max-w-[5.5rem]",
  sm: "h-8 max-w-[6.5rem]",
  md: "h-10 max-w-[9rem]",
  lg: "h-12 max-w-[11rem]",
  xl: "h-16 max-w-[14rem]",
  hero: "h-20 max-w-[min(100%,20rem)] sm:h-24",
} as const;

interface MesmsLogoProps {
  className?: string;
  size?: keyof typeof sizeClasses;
}

export function MesmsLogo({ className, size = "md" }: MesmsLogoProps) {
  return (
    <img
      src="/MESMS.svg"
      alt="MESMS — Medical Equipment Service Management"
      className={cn("w-auto shrink-0 object-contain object-left", sizeClasses[size], className)}
    />
  );
}
