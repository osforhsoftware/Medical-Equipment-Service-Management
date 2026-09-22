import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
  type TooltipItem,
} from "chart.js";
import { formatCurrency } from "@/lib/format";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

/** Colorful palette tuned to the MEMS navy/teal brand + accent hues */
export const CHART_COLORS = [
  "#1e4d8c", // primary navy
  "#1aa6b8", // accent teal
  "#2f9e6e", // success green
  "#f0a020", // warning amber
  "#1f8fd4", // info blue
  "#e0455a", // destructive coral
  "#7c5cbf", // violet
  "#0d9488", // teal-600
  "#ea580c", // orange
  "#2563eb", // bright blue
] as const;

export const CHART_COLOR_SOFT = CHART_COLORS.map((hex) => `${hex}cc`);

export function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function defaultDateRange(days = 29) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

export const DATE_RANGE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 6 },
  { label: "30 days", days: 29 },
  { label: "90 days", days: 89 },
] as const;

const tooltipBase = {
  backgroundColor: "rgba(15, 23, 42, 0.92)",
  titleColor: "#f8fafc",
  bodyColor: "#e2e8f0",
  borderColor: "rgba(148, 163, 184, 0.35)",
  borderWidth: 1,
  padding: 10,
  cornerRadius: 8,
};

export function currencyTooltip(label?: string) {
  return {
    ...tooltipBase,
    callbacks: {
      label: (ctx: TooltipItem<"bar" | "doughnut" | "line">) => {
        const value = typeof ctx.parsed === "number" ? ctx.parsed : (ctx.parsed as { y?: number }).y ?? 0;
        const name = label ?? ctx.dataset.label ?? ctx.label ?? "";
        return `${name}: ${formatCurrency(value)}`;
      },
    },
  };
}

export function countTooltip(label?: string) {
  return {
    ...tooltipBase,
    callbacks: {
      label: (ctx: TooltipItem<"bar" | "doughnut" | "line">) => {
        const value = typeof ctx.parsed === "number" ? ctx.parsed : (ctx.parsed as { y?: number }).y ?? 0;
        const name = label ?? ctx.dataset.label ?? ctx.label ?? "";
        return `${name}: ${value}`;
      },
    },
  };
}

export function stackedBarOptions(opts?: {
  currency?: boolean;
  legend?: boolean;
}): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: opts?.legend !== false,
        position: "bottom",
        labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "rectRounded", padding: 16 },
      },
      tooltip: opts?.currency ? currencyTooltip() : countTooltip(),
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, color: "#64748b", font: { size: 11 } },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.25)" },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: opts?.currency
            ? (value) => {
                const n = Number(value);
                if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}k`;
                return `₹${n}`;
              }
            : undefined,
        },
      },
    },
  };
}

export function doughnutOptions(opts?: { currency?: boolean }): ChartOptions<"doughnut"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle", padding: 14 },
      },
      tooltip: opts?.currency ? currencyTooltip() : countTooltip(),
    },
  };
}

export function groupedBarOptions(opts?: { currency?: boolean }): ChartOptions<"bar"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "bottom",
        labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "rectRounded", padding: 16 },
      },
      tooltip: opts?.currency ? currencyTooltip() : countTooltip(),
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, color: "#64748b", font: { size: 11 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "rgba(148, 163, 184, 0.25)" },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
    },
  };
}
