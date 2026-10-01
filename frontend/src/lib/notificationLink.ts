import { api, type BackendNotification } from "@/lib/api";

const REF_RE = /\b((?:SR|JOB|EST|PO|AMC)-\d{4}-\d{4})\b/gi;

function references(text: string): string[] {
  return [...text.matchAll(REF_RE)].map((match) => match[1].toUpperCase());
}

function pick(refs: string[], prefix: string) {
  return refs.find((ref) => ref.startsWith(`${prefix}-`));
}

async function idByReference<T extends { id: string; reference: string }>(
  load: () => Promise<{ data: T[] }>,
  reference: string,
): Promise<string | null> {
  const result = await load();
  return result.data.find((row) => row.reference.toUpperCase() === reference)?.id ?? null;
}

async function stockPurchaseHref(body: string, refs: string[]): Promise<string> {
  const rows = await api.listStockPurchaseRequests();
  const sku = body.match(/\(([^)]+)\)/)?.[1]?.trim();
  const sr = pick(refs, "SR");
  const job = pick(refs, "JOB");

  const serviceRequestId = sr
    ? await idByReference(
        () => api.listServiceRequests({ search: sr, limit: 5, completedScope: "all" }),
        sr,
      )
    : null;
  const jobId = job
    ? await idByReference(() => api.listJobs({ search: job, limit: 5, completedScope: "all" }), job)
    : null;

  const match = rows
    .map((row) => {
      let score = 0;
      if (sku && row.inventoryItem?.sku === sku) score += 4;
      if (serviceRequestId && row.serviceRequestId === serviceRequestId) score += 3;
      if (jobId && row.jobId === jobId) score += 3;
      if (row.status === "open") score += 1;
      return { row, score };
    })
    .filter((entry) => entry.score >= 4)
    .sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.row.createdAt).getTime() - new Date(a.row.createdAt).getTime(),
    )[0]?.row;

  return match ? `/app/stock-purchase-requests/${match.id}` : "/app/stock-purchase-requests";
}

/** Open the record the alert is about, never the notification center. */
export async function resolveNotificationHref(notification: BackendNotification): Promise<string> {
  const text = `${notification.title}\n${notification.body}`;
  const refs = references(text);
  const title = notification.title.toLowerCase();

  try {
    if (title.includes("purchase order")) {
      const po = pick(refs, "PO");
      if (po) {
        const id = await idByReference(() => api.listPurchaseOrders({ search: po, limit: 5 }), po);
        if (id) return `/app/purchase-orders/${id}`;
      }
      return "/app/purchase-orders";
    }

    if (title.includes("stock purchase")) {
      return stockPurchaseHref(notification.body, refs);
    }

    if (title === "parts request" || title.includes("scope request")) {
      const job = pick(refs, "JOB");
      if (job) {
        const id = await idByReference(
          () => api.listJobs({ search: job, limit: 5, completedScope: "all" }),
          job,
        );
        if (id) return `/app/jobs/${id}`;
      }
      return "/app/jobs";
    }

    if (title.startsWith("low stock")) {
      const name = notification.title.replace(/^low stock:\s*/i, "").trim();
      if (name) {
        const result = await api.listInventory({ search: name, limit: 10 });
        const item =
          result.data.find((row) => row.name.toLowerCase() === name.toLowerCase()) ?? result.data[0];
        if (item) return `/app/inventory/${item.id}`;
      }
      return "/app/inventory";
    }

    if (notification.type === "amc" || title.startsWith("amc ")) {
      const amc = pick(refs, "AMC");
      if (amc) {
        const contracts = await api.listAmcContracts();
        const contract = contracts.find((row) => row.reference.toUpperCase() === amc);
        if (contract?.customerName) {
          const customers = await api.listCustomers({ search: contract.customerName, limit: 5 });
          const customer = customers.data.find(
            (row) => row.name.toLowerCase() === contract.customerName.toLowerCase(),
          );
          if (customer) return `/app/customers/${customer.id}`;
        }
      }
      return "/app/customers";
    }

    const estimate = pick(refs, "EST");
    if (estimate || title.includes("estimate")) {
      if (estimate) {
        const id = await idByReference(() => api.listEstimates({ search: estimate, limit: 5 }), estimate);
        if (id) return `/app/estimates/${id}`;
      }
      if (title.includes("estimate")) return "/app/estimates";
    }

    const job = pick(refs, "JOB");
    if (job) {
      const id = await idByReference(
        () => api.listJobs({ search: job, limit: 5, completedScope: "all" }),
        job,
      );
      if (id) return `/app/jobs/${id}`;
      return "/app/jobs";
    }

    const ticket = pick(refs, "SR");
    if (ticket) {
      const id = await idByReference(
        () => api.listServiceRequests({ search: ticket, limit: 5, completedScope: "all" }),
        ticket,
      );
      if (id) return `/app/service-tickets/${id}`;
      return "/app/service-tickets";
    }

    if (notification.type === "stock") return "/app/inventory";
    if (notification.type === "job") return "/app/jobs";
    if (notification.type === "approval") return "/app/estimates";
    if (notification.type === "amc") return "/app/customers";
    return "/app/service-tickets";
  } catch {
    if (title.includes("stock purchase")) return "/app/stock-purchase-requests";
    if (title.includes("purchase order")) return "/app/purchase-orders";
    if (title.startsWith("low stock") || notification.type === "stock") return "/app/inventory";
    if (notification.type === "job" || title.includes("parts") || title.includes("scope")) return "/app/jobs";
    if (notification.type === "approval") return "/app/estimates";
    if (notification.type === "amc") return "/app/customers";
    return "/app/service-tickets";
  }
}
