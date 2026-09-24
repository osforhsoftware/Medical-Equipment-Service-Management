import type { BackendCustomer, BackendEquipment } from "@/lib/api";

export function isGuidedSetupEnabled(settings?: { guidedSetupFlow?: boolean } | null) {
  return settings?.guidedSetupFlow !== false;
}

export function customerSiteLocation(customer: Pick<BackendCustomer, "address" | "city" | "country">) {
  return [customer.address, customer.city, customer.country].filter(Boolean).join(", ");
}

export function serviceTicketPrefillPath(input: {
  customerId: string;
  equipmentIds: string[];
  description?: string;
}) {
  const params = new URLSearchParams({ new: "1", customerId: input.customerId });
  if (input.equipmentIds.length > 0) {
    params.set("equipmentIds", input.equipmentIds.join(","));
  }
  if (input.description?.trim()) {
    params.set("description", input.description.trim());
  }
  return `/app/service-tickets?${params.toString()}`;
}

export function ticketDescriptionFromEquipment(equipment: BackendEquipment) {
  const asset = equipment.assetTag ? ` (${equipment.assetTag})` : "";
  const site = equipment.location ? ` at ${equipment.location}` : "";
  return `Service requested for ${equipment.name}${asset}${site}.`;
}
