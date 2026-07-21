import { prisma } from "@/db/prisma";

/**
 * BaseRepository — generic CRUD helpers wrapping Prisma.
 * Extend this for each domain entity to get consistent data access.
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected abstract model: keyof typeof prisma;

  // Subclasses implement the specifics — this provides the pattern
  abstract findAll(tenantId: string, filters?: Record<string, unknown>): Promise<T[]>;
  abstract findById(id: string, tenantId: string): Promise<T | null>;
  abstract create(tenantId: string, data: CreateInput): Promise<T>;
  abstract update(id: string, tenantId: string, data: UpdateInput): Promise<T>;
  abstract delete(id: string, tenantId: string): Promise<void>;
}

/** Shared Prisma instance for repositories */
export { prisma };
