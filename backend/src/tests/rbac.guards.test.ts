import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express, { type Request, type Response, type NextFunction } from "express";
import { requireRole } from "@/middleware/auth";
import { API_WRITE_ACCESS, wrongRolesFor, type ApiWritePermission } from "@/config/apiAccess";

type FakeUser = { userId: string; tenantId: string; role: string; email: string };

function withUser(user: FakeUser) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.user = user;
    req.tenantId = user.tenantId;
    next();
  };
}

async function hit(
  app: express.Express,
  role: string,
): Promise<number> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;

  try {
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/protected", method: "POST" },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      // Inject role via header consumed by test app middleware below would need cookie —
      // instead rebuild app per role. This helper is unused for that path.
      void role;
      req.end();
    });
    return status;
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

async function statusForRole(permission: ApiWritePermission, role: string): Promise<number> {
  const allowed = API_WRITE_ACCESS[permission];
  const app = express();
  app.post(
    "/protected",
    withUser({
      userId: "u1",
      tenantId: "t1",
      role,
      email: `${role}@test.local`,
    }),
    requireRole(...allowed),
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  try {
    return await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: address.port, path: "/protected", method: "POST" },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.end();
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test("wrong roles receive 403 for each write permission", async () => {
  for (const permission of Object.keys(API_WRITE_ACCESS) as ApiWritePermission[]) {
    const wrongRoles = wrongRolesFor(permission);
    assert.ok(wrongRoles.length > 0, `${permission} should have at least one denied role`);
    for (const role of wrongRoles) {
      const status = await statusForRole(permission, role);
      assert.equal(status, 403, `${permission} must 403 for role ${role}`);
    }
  }
});

test("allowed roles receive 200 for each write permission", async () => {
  for (const permission of Object.keys(API_WRITE_ACCESS) as ApiWritePermission[]) {
    for (const role of API_WRITE_ACCESS[permission]) {
      const status = await statusForRole(permission, role);
      assert.equal(status, 200, `${permission} must allow role ${role}`);
    }
  }
});

// Keep TypeScript from complaining about unused helper in some toolchains.
void hit;
