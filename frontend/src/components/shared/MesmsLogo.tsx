import { cn } from "@/lib/utils";

/** MESMS.png is 300×272 (~1.1:1). Size by height only so nothing is cropped. */
const sizeClasses = {
  xs: "h-8",
  sm: "h-9",
  md: "h-11",
  lg: "h-14",
  xl: "h-20",
  hero: "h-24 sm:h-28",
} as const;

interface MesmsLogoProps {
  className?: string;
  size?: keyof typeof sizeClasses;
}

export function MesmsLogo({ className, size = "md" }: MesmsLogoProps) {
  return (
    <img
      src="/MESMS.png"
      alt="MESMS — Medical Equipment Service Management"
      className={cn("w-auto shrink-0 object-contain object-left", sizeClasses[size], className)}
    />
  );
}
