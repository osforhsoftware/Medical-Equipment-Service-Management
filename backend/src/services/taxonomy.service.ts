import type { TaxonomyTerm, TaxonomyType } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError } from "@/middleware/errorHandler";
import { taxonomyRepository } from "@/repositories/taxonomy.repository";
import {
  DEFAULT_TAXONOMY_TERMS,
  TAXONOMY_LEGACY_ALIASES,
  TAXONOMY_TYPES,
  slugifyTerm,
  type TaxonomyTypeName,
} from "@/config/taxonomyDefaults";

export type TaxonomyTermWithUsage = TaxonomyTerm & { usageCount: number };

function asType(type: string): TaxonomyType {
  return type as TaxonomyType;
}

export class TaxonomyService {
  async ensureDefaults(tenantId: string, type?: TaxonomyTypeName): Promise<void> {
    const types = type ? [type] : [...TAXONOMY_TYPES];
    for (const taxonomyType of types) {
      for (const term of DEFAULT_TAXONOMY_TERMS[taxonomyType]) {
        const existing = await taxonomyRepository.findBySlug(tenantId, asType(taxonomyType), term.slug);
        if (existing) continue;
        const nameTaken = await taxonomyRepository.findByName(tenantId, asType(taxonomyType), term.name);
        if (nameTaken) continue;
        await taxonomyRepository.create({
          tenantId,
          type: asType(taxonomyType),
          name: term.name,
          slug: term.slug,
          sortOrder: term.sortOrder,
          isActive: true,
          isSystem: true,
        });
      }
      await this.remapLegacyValues(tenantId, taxonomyType);
      await this.harvestExistingValues(tenantId, taxonomyType);
    }
  }

  async list(
    tenantId: string,
    type: TaxonomyTypeName,
    activeOnly = false,
  ): Promise<TaxonomyTermWithUsage[]> {
    await this.ensureDefaults(tenantId, type);
    const terms = await taxonomyRepository.findAll(tenantId, asType(type), activeOnly);
    const usage = await this.usageCounts(tenantId, type, terms);
    return terms.map((term) => ({ ...term, usageCount: usage.get(term.id) ?? 0 }));
  }

  async getById(id: string, tenantId: string): Promise<TaxonomyTerm> {
    const term = await taxonomyRepository.findById(id, tenantId);
    if (!term) throw new AppError("Taxonomy term not found", 404);
    return term;
  }

  async create(
    tenantId: string,
    data: {
      type: TaxonomyTypeName;
      name: string;
      slug?: string | null;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<TaxonomyTerm> {
    const name = data.name.trim();
    if (!name) throw new AppError("Name is required", 422);

    const duplicateName = await taxonomyRepository.findByName(tenantId, asType(data.type), name);
    if (duplicateName) throw new AppError("A term with that name already exists", 409);

    const requestedSlug = data.slug?.trim() ? slugifyTerm(data.slug) : slugifyTerm(name);
    const slug = await this.uniqueSlug(tenantId, data.type, requestedSlug);

    return taxonomyRepository.create({
      tenantId,
      type: asType(data.type),
      name,
      slug,
      description: data.description?.trim() || null,
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
      isSystem: false,
    });
  }

  async update(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ): Promise<TaxonomyTerm> {
    const existing = await this.getById(id, tenantId);

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new AppError("Name is required", 422);
      const duplicateName = await taxonomyRepository.findByName(
        tenantId,
        existing.type,
        name,
        existing.id,
      );
      if (duplicateName) throw new AppError("A term with that name already exists", 409);
    }

    let nextSlug: string | undefined;
    if (data.slug !== undefined) {
      if (existing.isSystem && data.slug.trim() !== existing.slug) {
        throw new AppError("The slug of a system term cannot be changed", 422);
      }
      const requested = slugifyTerm(data.slug);
      if (!requested) throw new AppError("Slug is required", 422);
      nextSlug = await this.uniqueSlug(tenantId, existing.type as TaxonomyTypeName, requested, existing.id);
    }

    return taxonomyRepository.update(id, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });
  }

  async delete(id: string, tenantId: string): Promise<{ deactivated: boolean; usageCount: number }> {
    const existing = await this.getById(id, tenantId);
    const usageCount = await this.countUsage(tenantId, existing.type as TaxonomyTypeName, existing);

    if (usageCount > 0) {
      if (existing.isActive) {
        await taxonomyRepository.update(id, { isActive: false });
        return { deactivated: true, usageCount };
      }
      throw new AppError(
        `This term is used by ${usageCount} record${usageCount === 1 ? "" : "s"} and cannot be deleted. Deactivate it instead.`,
        409,
      );
    }

    await taxonomyRepository.delete(id, tenantId);
    return { deactivated: false, usageCount: 0 };
  }

  /**
   * Resolve a submitted value to an active term slug.
   * Inactive terms are allowed only when they match `currentValue` (already assigned).
   */
  async resolveSlug(
    tenantId: string,
    type: TaxonomyTypeName,
    value: string,
    currentValue?: string | null,
  ): Promise<string> {
    await this.ensureDefaults(tenantId, type);
    const trimmed = value.trim();
    if (!trimmed) {
      throw new AppError(this.missingMessage(type), 422);
    }

    const term = await taxonomyRepository.findBySlugOrName(tenantId, asType(type), trimmed);
    if (!term) {
      throw new AppError(this.missingMessage(type), 422);
    }

    const alreadyAssigned =
      currentValue === term.slug ||
      currentValue === term.name ||
      currentValue === trimmed;

    if (!term.isActive && !alreadyAssigned) {
      throw new AppError(`${term.name} is inactive. Choose an active option.`, 422);
    }

    return term.slug;
  }

  private missingMessage(type: TaxonomyTypeName): string {
    if (type === "equipment_category") return "Select a valid equipment category.";
    if (type === "equipment_condition") return "Select a valid equipment condition.";
    return "Select a valid customer type.";
  }

  private async uniqueSlug(
    tenantId: string,
    type: TaxonomyTypeName,
    base: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = base.slice(0, 80);
    let n = 2;
    while (await taxonomyRepository.findBySlug(tenantId, asType(type), slug, excludeId)) {
      const suffix = `-${n++}`;
      slug = `${base.slice(0, Math.max(1, 80 - suffix.length))}${suffix}`;
    }
    return slug;
  }

  private async remapLegacyValues(tenantId: string, type: TaxonomyTypeName): Promise<void> {
    const aliases = TAXONOMY_LEGACY_ALIASES[type];
    for (const [from, to] of Object.entries(aliases)) {
      if (from === to) continue;
      if (type === "equipment_category") {
        await prisma.equipment.updateMany({
          where: { tenantId, category: from },
          data: { category: to },
        });
      } else if (type === "equipment_condition") {
        await prisma.equipment.updateMany({
          where: { tenantId, condition: from },
          data: { condition: to },
        });
      } else {
        await prisma.customer.updateMany({
          where: { tenantId, type: from },
          data: { type: to },
        });
      }
    }
  }

  private async harvestExistingValues(tenantId: string, type: TaxonomyTypeName): Promise<void> {
    const values = await this.distinctStoredValues(tenantId, type);
    const terms = await taxonomyRepository.findAll(tenantId, asType(type), false);

    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      const match = terms.find(
        (term) => term.slug === value || term.name === value,
      );
      if (match) {
        if (match.slug !== value) {
          await this.remapStoredValue(tenantId, type, value, match.slug);
        }
        continue;
      }

      const slug = await this.uniqueSlug(tenantId, type, slugifyTerm(value));
      const name = this.uniqueHarvestName(terms, value);
      const created = await taxonomyRepository.create({
        tenantId,
        type: asType(type),
        name,
        slug,
        sortOrder: 100,
        isActive: true,
        isSystem: false,
      });
      terms.push(created);
      if (slug !== value) {
        await this.remapStoredValue(tenantId, type, value, slug);
      }
    }
  }

  private uniqueHarvestName(terms: TaxonomyTerm[], name: string): string {
    const taken = new Set(terms.map((t) => t.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    let n = 2;
    let candidate = `${name} (${n})`;
    while (taken.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${name} (${n})`;
    }
    return candidate;
  }

  private async distinctStoredValues(tenantId: string, type: TaxonomyTypeName): Promise<string[]> {
    if (type === "equipment_category") {
      const rows = await prisma.equipment.findMany({
        where: { tenantId },
        select: { category: true },
        distinct: ["category"],
      });
      return rows.map((r) => r.category);
    }
    if (type === "equipment_condition") {
      const rows = await prisma.equipment.findMany({
        where: { tenantId },
        select: { condition: true },
        distinct: ["condition"],
      });
      return rows.map((r) => r.condition);
    }
    const rows = await prisma.customer.findMany({
      where: { tenantId },
      select: { type: true, typeOther: true },
    });
    const values = new Set<string>();
    for (const row of rows) {
      if (row.type) values.add(row.type);
      if (row.typeOther) values.add(row.typeOther);
    }
    return [...values];
  }

  private async remapStoredValue(
    tenantId: string,
    type: TaxonomyTypeName,
    from: string,
    to: string,
  ): Promise<void> {
    if (from === to) return;
    if (type === "equipment_category") {
      await prisma.equipment.updateMany({ where: { tenantId, category: from }, data: { category: to } });
      return;
    }
    if (type === "equipment_condition") {
      await prisma.equipment.updateMany({ where: { tenantId, condition: from }, data: { condition: to } });
      return;
    }
    await prisma.customer.updateMany({ where: { tenantId, type: from }, data: { type: to } });
  }

  private async usageCounts(
    tenantId: string,
    type: TaxonomyTypeName,
    terms: TaxonomyTerm[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term.id, 0);

    if (type === "customer_type") {
      const rows = await prisma.customer.groupBy({
        by: ["type"],
        where: { tenantId },
        _count: { _all: true },
      });
      for (const row of rows) {
        const term = terms.find((t) => t.slug === row.type || t.name === row.type);
        if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
      }
      return counts;
    }

    if (type === "equipment_category") {
      const rows = await prisma.equipment.groupBy({
        by: ["category"],
        where: { tenantId },
        _count: { _all: true },
      });
      for (const row of rows) {
        const term = terms.find((t) => t.slug === row.category || t.name === row.category);
        if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
      }
      return counts;
    }

    const rows = await prisma.equipment.groupBy({
      by: ["condition"],
      where: { tenantId },
      _count: { _all: true },
    });
    for (const row of rows) {
      const term = terms.find((t) => t.slug === row.condition || t.name === row.condition);
      if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
    }
    return counts;
  }

  private async countUsage(
    tenantId: string,
    type: TaxonomyTypeName,
    term: TaxonomyTerm,
  ): Promise<number> {
    if (type === "equipment_category") {
      return prisma.equipment.count({
        where: { tenantId, OR: [{ category: term.slug }, { category: term.name }] },
      });
    }
    if (type === "equipment_condition") {
      return prisma.equipment.count({
        where: { tenantId, OR: [{ condition: term.slug }, { condition: term.name }] },
      });
    }
    return prisma.customer.count({
      where: {
        tenantId,
        OR: [
          { type: term.slug },
          { type: term.name },
          { typeOther: term.slug },
          { typeOther: term.name },
        ],
      },
    });
  }
}

export const taxonomyService = new TaxonomyService();
