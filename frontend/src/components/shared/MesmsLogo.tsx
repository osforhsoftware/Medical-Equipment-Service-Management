import React from "react";
import { cn } from "@/lib/utils";

export type LogoVariant = "horizontal" | "icon" | "stacked" | "monochrome" | "full";
export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";
export type LogoTheme = "light" | "dark" | "auto";

interface MesmsLogoProps {
  className?: string;
  size?: LogoSize;
  variant?: LogoVariant;
  theme?: LogoTheme;
  customLogoUrl?: string | null;
  showSubtitle?: boolean;
  onClick?: () => void;
}

const sizeConfig: Record<
  LogoSize,
  {
    container: string;
    iconSize: number;
    titleClass: string;
    subtitleClass: string;
    gap: string;
  }
> = {
  xs: {
    container: "h-7",
    iconSize: 26,
    titleClass: "text-xs tracking-wider font-extrabold",
    subtitleClass: "text-[8px] tracking-widest hidden sm:inline-block",
    gap: "gap-1.5",
  },
  sm: {
    container: "h-8",
    iconSize: 30,
    titleClass: "text-sm tracking-wider font-extrabold",
    subtitleClass: "text-[9px] tracking-widest hidden sm:inline-block",
    gap: "gap-2",
  },
  md: {
    container: "h-10",
    iconSize: 36,
    titleClass: "text-base tracking-widest font-black",
    subtitleClass: "text-[10px] tracking-widest font-semibold",
    gap: "gap-2.5",
  },
  lg: {
    container: "h-12",
    iconSize: 44,
    titleClass: "text-xl tracking-widest font-black",
    subtitleClass: "text-[11px] tracking-widest font-bold",
    gap: "gap-3",
  },
  xl: {
    container: "h-16",
    iconSize: 56,
    titleClass: "text-2xl tracking-widest font-black",
    subtitleClass: "text-xs tracking-widest font-bold",
    gap: "gap-3.5",
  },
  hero: {
    container: "h-20 sm:h-24",
    iconSize: 72,
    titleClass: "text-3xl sm:text-4xl tracking-widest font-black",
    subtitleClass: "text-xs sm:text-sm tracking-widest font-bold",
    gap: "gap-4",
  },
};

export function MesmsLogo({
  className,
  size = "md",
  variant = "horizontal",
  theme = "auto",
  customLogoUrl,
  showSubtitle = true,
  onClick,
}: MesmsLogoProps) {
  const config = sizeConfig[size] || sizeConfig.md;

  // If a custom tenant logo image URL is provided, display custom logo cleanly
  if (customLogoUrl) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "inline-flex items-center shrink-0 overflow-hidden",
          config.container,
          onClick && "cursor-pointer hover:opacity-90 transition-opacity",
          className
        )}
      >
        <img
          src={customLogoUrl}
          alt="Company Logo"
          className="h-full w-auto max-w-full object-contain object-left"
        />
      </div>
    );
  }

  const isDark = theme === "dark";
  const isMono = variant === "monochrome";

  // Text colors based on theme & monochrome settings
  const textColor = isMono
    ? "text-current"
    : isDark
    ? "text-white"
    : theme === "light"
    ? "text-slate-900"
    : "text-foreground";

  const subtextColor = isMono
    ? "text-current opacity-75"
    : isDark
    ? "text-sky-300"
    : "text-sky-600 dark:text-sky-400";

  // SVG emblem badge icon component
  const LogoMark = (
    <svg
      width={config.iconSize}
      height={config.iconSize}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-sm transition-transform duration-300 hover:scale-105"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`grad-bg-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={isMono ? "currentColor" : "#0284c7"} />
          <stop offset="50%" stopColor={isMono ? "currentColor" : "#0d9488"} />
          <stop offset="100%" stopColor={isMono ? "currentColor" : "#059669"} />
        </linearGradient>
        <linearGradient id={`grad-pulse-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isMono ? "#ffffff" : "#38bdf8"} />
          <stop offset="100%" stopColor={isMono ? "#ffffff" : "#34d399"} />
        </linearGradient>
      </defs>

      {/* Background Badge Squircle */}
      <rect
        x="0"
        y="0"
        width="64"
        height="64"
        rx="18"
        fill={isMono ? "currentColor" : `url(#grad-bg-${size})`}
        fillOpacity={isMono ? 0.15 : 1}
      />

      {/* Precision Medical Cross Cutout */}
      <path
        d="M 32,16 V 48 M 16,32 H 48"
        stroke={isMono ? "currentColor" : "#ffffff"}
        strokeWidth="6.5"
        strokeLinecap="round"
      />

      {/* Electrocardiogram Heartbeat Pulse Line (represents equipment diagnostics & health) */}
      <path
        d="M 14,32 H 23 L 28,21 L 34,43 L 39,27 L 43,35 L 50,32"
        stroke={isMono ? "currentColor" : `url(#grad-pulse-${size})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Active Sensor Node Indicator */}
      <circle
        cx="34"
        cy="43"
        r="2.5"
        fill={isMono ? "currentColor" : "#ffffff"}
      />
    </svg>
  );

  if (variant === "icon") {
    return (
      <div
        onClick={onClick}
        title="MESMS — Medical Equipment Service Management"
        className={cn(
          "inline-flex items-center shrink-0 justify-center",
          onClick && "cursor-pointer",
          className
        )}
      >
        {LogoMark}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div
        onClick={onClick}
        className={cn(
          "inline-flex flex-col items-center justify-center text-center shrink-0",
          config.gap,
          onClick && "cursor-pointer hover:opacity-95 transition-opacity",
          className
        )}
      >
        {LogoMark}
        <div className="flex flex-col items-center">
          <span className={cn(config.titleClass, textColor)}>MESMS</span>
          {showSubtitle && (
            <span className={cn(config.subtitleClass, subtextColor, "uppercase mt-0.5")}>
              Medical Equipment Service Management
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: Horizontal / Full logo suite format
  return (
    <div
      onClick={onClick}
      className={cn(
        "inline-flex items-center shrink-0 select-none",
        config.gap,
        onClick && "cursor-pointer hover:opacity-95 transition-opacity",
        className
      )}
    >
      {LogoMark}
      <div className="flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span className={cn(config.titleClass, textColor)}>MESMS</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
        </div>
        {showSubtitle && size !== "xs" && (
          <span className={cn(config.subtitleClass, subtextColor, "uppercase mt-0.5 tracking-wider")}>
            Equipment Service Management
          </span>
        )}
      </div>
    </div>
  );
}
