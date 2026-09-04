import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "@/config/env";
import { errorHandler } from "@/middleware/errorHandler";
import { auditMutation } from "@/middleware/audit";

// Routes
import authRoutes from "@/routes/auth.routes";
import customersRoutes from "@/routes/customers.routes";
import equipmentRoutes from "@/routes/equipment.routes";
import serviceRequestsRoutes from "@/routes/serviceRequests.routes";
import estimatesRoutes from "@/routes/estimates.routes";
import jobsRoutes from "@/routes/jobs.routes";
import inventoryRoutes from "@/routes/inventory.routes";
import suppliersRoutes from "@/routes/suppliers.routes";
import purchaseOrdersRoutes from "@/routes/purchaseOrders.routes";
import stockTransfersRoutes from "@/routes/stockTransfers.routes";
import amcRoutes from "@/routes/amc.routes";
import billingRoutes from "@/routes/billing.routes";
import notificationsRoutes from "@/routes/notifications.routes";
import auditLogsRoutes from "@/routes/auditLogs.routes";
import usersRoutes from "@/routes/users.routes";
import settingsRoutes from "@/routes/settings.routes";
import dashboardRoutes from "@/routes/dashboard.routes";
import salesRoutes from "@/routes/sales.routes";
import inspectionsRoutes from "@/routes/inspections.routes";
import domainRoutes from "@/routes/domain.routes";
import filesRoutes from "@/routes/files.routes";
import taxonomyRoutes from "@/routes/taxonomy.routes";

const app = express();
app.set("trust proxy", 1);

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  const configured = [env.CORS_ORIGIN, env.FRONTEND_URL]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes(origin)) return true;
  if (env.NODE_ENV === "production") return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, origin ?? true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditMutation);

// ── Health Check ─────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── API Routes ────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/service-requests", serviceRequestsRoutes);
app.use("/api/service-tickets", serviceRequestsRoutes);
app.use("/api/estimates", estimatesRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/purchase-orders", purchaseOrdersRoutes);
app.use("/api/stock-transfers", stockTransfersRoutes);
app.use("/api/amc", amcRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/inspections", inspectionsRoutes);
app.use("/api/domain", domainRoutes);
app.use("/api/files", filesRoutes);
app.use("/api/taxonomy", taxonomyRoutes);

// ── 404 Catch-All ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found", data: null });
});

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────
function logReady() {
  console.log(`
╔════════════════════════════════════════════╗
║   MESMS Prisma API Server                  ║
║   http://127.0.0.1:${env.PORT}/api/health          ║
║   Environment: ${env.NODE_ENV}                 ║
╚════════════════════════════════════════════╝
  `);
}

const server = http.createServer(app);
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL") {
    app.listen(env.PORT, "0.0.0.0", logReady);
    return;
  }
  console.error(err);
  process.exit(1);
});
server.listen({ port: env.PORT, host: "::", ipv6Only: false }, logReady);

export default app;
