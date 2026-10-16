import { prisma } from "@/db/prisma";
import type { Prisma, TaxonomyTerm, TaxonomyType } from "@prisma/client";

export class TaxonomyRepository {
  async findAll(
    tenantId: string,
    type: TaxonomyType,
    activeOnly = false,
  ): Promise<TaxonomyTerm[]> {
    return prisma.taxonomyTerm.findMany({
      where: {
        tenantId,
        type,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findById(id: string, tenantId: string): Promise<TaxonomyTerm | null> {
    return prisma.taxonomyTerm.findFirst({ where: { id, tenantId } });
  }

  async findBySlugOrName(
    tenantId: string,
    type: TaxonomyType,
    value: string,
  ): Promise<TaxonomyTerm | null> {
    return prisma.taxonomyTerm.findFirst({
      where: {
        tenantId,
        type,
        OR: [{ slug: value }, { name: value }],
      },
    });
  }

  async findBySlug(
    tenantId: string,
    type: TaxonomyType,
    slug: string,
    excludeId?: string,
  ): Promise<TaxonomyTerm | null> {
    return prisma.taxonomyTerm.findFirst({
      where: {
        tenantId,
        type,
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async findByName(
    tenantId: string,
    type: TaxonomyType,
    name: string,
    excludeId?: string,
  ): Promise<TaxonomyTerm | null> {
    return prisma.taxonomyTerm.findFirst({
      where: {
        tenantId,
        type,
        name,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
  }

  async countByType(tenantId: string, type: TaxonomyType): Promise<number> {
    return prisma.taxonomyTerm.count({ where: { tenantId, type } });
  }

  async create(data: Prisma.TaxonomyTermUncheckedCreateInput): Promise<TaxonomyTerm> {
    return prisma.taxonomyTerm.create({ data });
  }

  async update(id: string, data: Prisma.TaxonomyTermUpdateInput): Promise<TaxonomyTerm> {
    return prisma.taxonomyTerm.update({ where: { id }, data });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    await prisma.taxonomyTerm.deleteMany({ where: { id, tenantId } });
  }

  async suppressedSlugs(tenantId: string, type: TaxonomyType): Promise<Set<string>> {
    const rows = await prisma.taxonomySuppression.findMany({
      where: { tenantId, type },
      select: { slug: true },
    });
    return new Set(rows.map((row) => row.slug));
  }

  async suppress(tenantId: string, type: TaxonomyType, slug: string): Promise<void> {
    await prisma.taxonomySuppression.upsert({
      where: { tenantId_type_slug: { tenantId, type, slug } },
      create: { tenantId, type, slug },
      update: {},
    });
  }

  async clearSuppression(tenantId: string, type: TaxonomyType, slug: string): Promise<void> {
    await prisma.taxonomySuppression.deleteMany({ where: { tenantId, type, slug } });
  }
}

export const taxonomyRepository = new TaxonomyRepository();
