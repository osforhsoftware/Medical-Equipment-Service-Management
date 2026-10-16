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
      if (taxonomyType === "inventory_subcategory") {
        await this.ensureDefaults(tenantId, "inventory_category");
      }
      const suppressed = await taxonomyRepository.suppressedSlugs(tenantId, asType(taxonomyType));
      for (const term of DEFAULT_TAXONOMY_TERMS[taxonomyType]) {
        if (suppressed.has(term.slug)) continue;
        const existing = await taxonomyRepository.findBySlug(tenantId, asType(taxonomyType), term.slug);
        if (existing) continue;
        const nameTaken = await taxonomyRepository.findByName(tenantId, asType(taxonomyType), term.name);
        if (nameTaken) continue;
        let parentId: string | null = null;
        if (term.parentSlug) {
          const parentType = taxonomyType === "inventory_subcategory" ? "inventory_category" : taxonomyType;
          const parent = await taxonomyRepository.findBySlug(tenantId, asType(parentType), term.parentSlug);
          parentId = parent?.id ?? null;
        }
        await taxonomyRepository.create({
          tenantId,
          type: asType(taxonomyType),
          name: term.name,
          slug: term.slug,
          sortOrder: term.sortOrder,
          parentId,
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
      parentId?: string | null;
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
    const parentId = await this.resolveParentId(tenantId, data.type, data.parentId);
    await taxonomyRepository.clearSuppression(tenantId, asType(data.type), slug);

    return taxonomyRepository.create({
      tenantId,
      type: asType(data.type),
      name,
      slug,
      description: data.description?.trim() || null,
      parentId,
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
      parentId?: string | null;
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

    const parentId =
      data.parentId !== undefined
        ? await this.resolveParentId(tenantId, existing.type as TaxonomyTypeName, data.parentId)
        : undefined;

    return taxonomyRepository.update(id, {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(nextSlug ? { slug: nextSlug } : {}),
      ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
      ...(parentId !== undefined ? { parent: parentId ? { connect: { id: parentId } } : { disconnect: true } } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    });
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.getById(id, tenantId);
    const type = existing.type as TaxonomyTypeName;
    const breakdown = await this.usageBreakdown(tenantId, type, existing);
    const usageCount = this.totalUsage(breakdown);

    if (usageCount > 0) {
      throw new AppError(this.usageBlockMessage(existing.name, type, breakdown), 409);
    }

    await taxonomyRepository.suppress(tenantId, existing.type, existing.slug);
    try {
      await taxonomyRepository.delete(id, tenantId);
    } catch (err) {
      await taxonomyRepository.clearSuppression(tenantId, existing.type, existing.slug);
      throw err;
    }
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
    if (type === "inventory_category") return "Select a valid inventory category.";
    if (type === "inventory_subcategory") return "Select a valid inventory subcategory.";
    if (type === "expense_category") return "Select a valid expense category.";
    return "Select a valid customer type.";
  }

  private async resolveParentId(
    tenantId: string,
    type: TaxonomyTypeName,
    parentId?: string | null,
  ): Promise<string | null> {
    if (type === "inventory_subcategory") {
      if (!parentId) throw new AppError("Select a parent category for this subcategory.", 422);
    } else if (!parentId) {
      return null;
    }

    const parent = await taxonomyRepository.findById(parentId!, tenantId);
    if (!parent) throw new AppError("Parent category not found", 404);
    if (type === "inventory_subcategory" && parent.type !== "inventory_category") {
      throw new AppError("Subcategories must belong to an inventory category.", 422);
    }
    return parent.id;
  }

  private inventoryStoredField(type: TaxonomyTypeName): "category" | "subcategory" | null {
    if (type === "inventory_category") return "category";
    if (type === "inventory_subcategory") return "subcategory";
    return null;
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
      } else if (type === "inventory_category") {
        await prisma.inventoryItem.updateMany({
          where: { tenantId, category: from },
          data: { category: to },
        });
      } else if (type === "inventory_subcategory") {
        await prisma.inventoryItem.updateMany({
          where: { tenantId, subcategory: from },
          data: { subcategory: to },
        });
      } else if (type === "expense_category") {
        await prisma.projectExpense.updateMany({
          where: { tenantId, category: from },
          data: { category: to },
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
    const suppressed = await taxonomyRepository.suppressedSlugs(tenantId, asType(type));

    for (const raw of values) {
      const value = raw.trim();
      if (!value) continue;
      if (suppressed.has(value) || suppressed.has(slugifyTerm(value))) continue;
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
    if (type === "inventory_category") {
      const rows = await prisma.inventoryItem.findMany({
        where: { tenantId },
        select: { category: true },
        distinct: ["category"],
      });
      return rows.map((r) => r.category);
    }
    if (type === "inventory_subcategory") {
      const rows = await prisma.inventoryItem.findMany({
        where: { tenantId, subcategory: { not: null } },
        select: { subcategory: true },
        distinct: ["subcategory"],
      });
      return rows.map((r) => r.subcategory).filter((value): value is string => Boolean(value));
    }
    if (type === "expense_category") {
      const rows = await prisma.projectExpense.findMany({
        where: { tenantId },
        select: { category: true },
        distinct: ["category"],
      });
      return rows.map((r) => r.category);
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
    if (type === "inventory_category") {
      await prisma.inventoryItem.updateMany({ where: { tenantId, category: from }, data: { category: to } });
      return;
    }
    if (type === "inventory_subcategory") {
      await prisma.inventoryItem.updateMany({ where: { tenantId, subcategory: from }, data: { subcategory: to } });
      return;
    }
    if (type === "expense_category") {
      await prisma.projectExpense.updateMany({ where: { tenantId, category: from }, data: { category: to } });
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
      const otherRows = await prisma.customer.groupBy({
        by: ["typeOther"],
        where: { tenantId, typeOther: { not: null } },
        _count: { _all: true },
      });
      for (const row of otherRows) {
        const value = row.typeOther?.trim();
        if (!value) continue;
        const term = terms.find((t) => t.slug === value || t.name === value);
        if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
      }
      await this.addChildUsage(tenantId, counts);
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
      await this.addChildUsage(tenantId, counts);
      return counts;
    }

    if (type === "inventory_category" || type === "inventory_subcategory") {
      const field = this.inventoryStoredField(type)!;
      const rows = await prisma.inventoryItem.groupBy({
        by: [field],
        where: { tenantId },
        _count: { _all: true },
      });
      for (const row of rows) {
        const value = row[field];
        if (!value) continue;
        const term = terms.find((t) => t.slug === value || t.name === value);
        if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
      }
      await this.addChildUsage(tenantId, counts);
      return counts;
    }

    if (type === "expense_category") {
      const rows = await prisma.projectExpense.groupBy({
        by: ["category"],
        where: { tenantId },
        _count: { _all: true },
      });
      for (const row of rows) {
        const term = terms.find((t) => t.slug === row.category || t.name === row.category);
        if (term) counts.set(term.id, (counts.get(term.id) ?? 0) + row._count._all);
      }
      await this.addChildUsage(tenantId, counts);
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
    await this.addChildUsage(tenantId, counts);
    return counts;
  }

  private async addChildUsage(tenantId: string, counts: Map<string, number>): Promise<void> {
    const rows = await prisma.taxonomyTerm.groupBy({
      by: ["parentId"],
      where: { tenantId, parentId: { not: null } },
      _count: { _all: true },
    });
    for (const row of rows) {
      if (!row.parentId || !counts.has(row.parentId)) continue;
      counts.set(row.parentId, (counts.get(row.parentId) ?? 0) + row._count._all);
    }
  }

  private async usageBreakdown(
    tenantId: string,
    type: TaxonomyTypeName,
    term: TaxonomyTerm,
  ): Promise<{
    equipment: number;
    inventoryItems: number;
    expenses: number;
    customers: number;
    children: number;
  }> {
    const equipment = type === "equipment_category" || type === "equipment_condition"
      ? await this.countUsage(tenantId, type, term)
      : 0;
    const inventoryItems = type === "inventory_category" || type === "inventory_subcategory"
      ? await this.countUsage(tenantId, type, term)
      : 0;
    const expenses = type === "expense_category" ? await this.countUsage(tenantId, type, term) : 0;
    const customers = type === "customer_type" ? await this.countUsage(tenantId, type, term) : 0;
    const children = await prisma.taxonomyTerm.count({
      where: { tenantId, parentId: term.id },
    });
    return { equipment, inventoryItems, expenses, customers, children };
  }

  private totalUsage(breakdown: {
    equipment: number;
    inventoryItems: number;
    expenses: number;
    customers: number;
    children: number;
  }): number {
    return (
      breakdown.equipment +
      breakdown.inventoryItems +
      breakdown.expenses +
      breakdown.customers +
      breakdown.children
    );
  }

  private usageBlockMessage(
    name: string,
    type: TaxonomyTypeName,
    breakdown: {
      equipment: number;
      inventoryItems: number;
      expenses: number;
      customers: number;
      children: number;
    },
  ): string {
    const parts: string[] = [];
    const push = (count: number, singular: string, plural: string) => {
      if (count > 0) parts.push(`${count} ${count === 1 ? singular : plural}`);
    };
    push(breakdown.equipment, "equipment record", "equipment records");
    push(breakdown.inventoryItems, "inventory item", "inventory items");
    push(breakdown.expenses, "expense", "expenses");
    push(breakdown.customers, "customer", "customers");
    push(breakdown.children, "subcategory", "subcategories");
    const list =
      parts.length <= 1
        ? (parts[0] ?? "linked records")
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    const noun =
      type === "inventory_subcategory"
        ? "subcategory"
        : type === "equipment_condition"
          ? "condition"
          : type === "customer_type"
            ? "customer type"
            : "category";
    return `${name} is used by ${list}. Reassign those records to another ${noun} before deleting it.`;
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
    if (type === "inventory_category") {
      return prisma.inventoryItem.count({
        where: { tenantId, OR: [{ category: term.slug }, { category: term.name }] },
      });
    }
    if (type === "inventory_subcategory") {
      return prisma.inventoryItem.count({
        where: { tenantId, OR: [{ subcategory: term.slug }, { subcategory: term.name }] },
      });
    }
    if (type === "expense_category") {
      return prisma.projectExpense.count({
        where: { tenantId, OR: [{ category: term.slug }, { category: term.name }] },
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
