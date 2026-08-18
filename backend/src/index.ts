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
import inspectionsRoutes from "@/routes/inspections.routes";
import domainRoutes from "@/routes/domain.routes";
import filesRoutes from "@/routes/files.routes";
import taxonomyRoutes from "@/routes/taxonomy.routes";

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
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
app.listen(env.PORT, env.HOST, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   MESMS Prisma API Server                  ║
║   http://${env.HOST}:${env.PORT}/api/health        ║
║   Environment: ${env.NODE_ENV}                 ║
╚════════════════════════════════════════════╝
  `);
});

export default app;
