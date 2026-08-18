import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

interface ResponsivePageProps {
  mobile: ReactNode;
  desktop: ReactNode;
}

/** Renders mobile or desktop page based on viewport breakpoint. */
export function ResponsivePage({ mobile, desktop }: ResponsivePageProps) {
  const isMobile = useIsMobile();
  return isMobile ? mobile : desktop;
}
