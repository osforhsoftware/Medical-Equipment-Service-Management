import { Bar, Doughnut } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import {
  CHART_COLORS,
  CHART_COLOR_SOFT,
  doughnutOptions,
  groupedBarOptions,
  stackedBarOptions,
} from "@/lib/charts";

type EmptyProps = { message?: string; height?: number };

function ChartEmpty({ message = "No data for this date range", height = 260 }: EmptyProps) {
  return (
    <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
      {message}
    </div>
  );
}

export function StackedRevenueChart({
  labels,
  saleRevenue,
  serviceRevenue,
  height = 280,
}: {
  labels: string[];
  saleRevenue: number[];
  serviceRevenue: number[];
  height?: number;
}) {
  const hasData = saleRevenue.some((v) => v > 0) || serviceRevenue.some((v) => v > 0);
  if (!labels.length || !hasData) return <ChartEmpty height={height} />;

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Sale billing",
        data: saleRevenue,
        backgroundColor: CHART_COLORS[1],
        borderRadius: 4,
        stack: "revenue",
      },
      {
        label: "Service billing",
        data: serviceRevenue,
        backgroundColor: CHART_COLORS[0],
        borderRadius: 4,
        stack: "revenue",
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={stackedBarOptions({ currency: true })} />
    </div>
  );
}

export function GroupedActivityChart({
  labels,
  jobs,
  tickets,
  height = 280,
}: {
  labels: string[];
  jobs: number[];
  tickets: number[];
  height?: number;
}) {
  const hasData = jobs.some((v) => v > 0) || tickets.some((v) => v > 0);
  if (!labels.length || !hasData) return <ChartEmpty height={height} />;

  const data: ChartData<"bar"> = {
    labels,
    datasets: [
      {
        label: "Jobs created",
        data: jobs,
        backgroundColor: CHART_COLORS[2],
        borderRadius: 6,
        maxBarThickness: 28,
      },
      {
        label: "Tickets opened",
        data: tickets,
        backgroundColor: CHART_COLORS[4],
        borderRadius: 6,
        maxBarThickness: 28,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Bar data={data} options={groupedBarOptions()} />
    </div>
  );
}

export function JobsByTypeDoughnut({
  rows,
  height = 260,
}: {
  rows: { type: string; count: number }[];
  height?: number;
}) {
  if (!rows.length) return <ChartEmpty height={height} />;

  const data: ChartData<"doughnut"> = {
    labels: rows.map((r) => r.type),
    datasets: [
      {
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={doughnutOptions()} />
    </div>
  );
}

export function JobsByStatusDoughnut({
  rows,
  height = 260,
}: {
  rows: { status: string; count: number }[];
  height?: number;
}) {
  if (!rows.length) return <ChartEmpty height={height} />;

  const data: ChartData<"doughnut"> = {
    labels: rows.map((r) => r.status),
    datasets: [
      {
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((_, i) => CHART_COLOR_SOFT[i % CHART_COLOR_SOFT.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={doughnutOptions()} />
    </div>
  );
}

export function BillingMixDoughnut({
  rows,
  height = 260,
}: {
  rows: { type: string; count: number }[];
  height?: number;
}) {
  if (!rows.length) return <ChartEmpty height={height} message="No billing recorded in this range." />;

  const data: ChartData<"doughnut"> = {
    labels: rows.map((r) => r.type),
    datasets: [
      {
        data: rows.map((r) => r.count),
        backgroundColor: [CHART_COLORS[1], CHART_COLORS[0], CHART_COLORS[3], CHART_COLORS[6]],
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Doughnut data={data} options={doughnutOptions({ currency: true })} />
    </div>
  );
}

export function HorizontalJobsBar({
  rows,
  height = 260,
}: {
  rows: { type: string; count: number }[];
  height?: number;
}) {
  if (!rows.length) return <ChartEmpty height={height} />;

  const data: ChartData<"bar"> = {
    labels: rows.map((r) => r.type),
    datasets: [
      {
        label: "Jobs",
        data: rows.map((r) => r.count),
        backgroundColor: rows.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderRadius: 6,
        maxBarThickness: 22,
      },
    ],
  };

  return (
    <div style={{ height }}>
      <Bar
        data={data}
        options={{
          ...groupedBarOptions(),
          indexAxis: "y",
          plugins: {
            ...groupedBarOptions().plugins,
            legend: { display: false },
          },
        }}
      />
    </div>
  );
}
