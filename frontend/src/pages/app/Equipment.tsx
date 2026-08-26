import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, QrCode } from "lucide-react";
import { EquipmentFormDialog } from "@/components/equipment/EquipmentFormDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { api, type BackendEquipment } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useListingUrlState } from "@/hooks/useListingUrlState";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { EMPTY_PAGINATION_META } from "@/lib/listing";
import { useAuth } from "@/context/AuthContext";
import { termLabel } from "@/lib/taxonomy";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EquipmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasRole } = useAuth();
  const canManage = hasRole(["admin", "coordinator", "inventory"]);
  const {
    search,
    setSearch,
    filters,
    setFilter,
    listParams,
    setPage,
    setLimit,
  } = useListingUrlState({ filterKeys: ["condition", "customerId", "category"] });

  const debouncedSearch = useDebouncedValue(search);
  const queryParams = useMemo(
    () => ({ ...listParams, search: debouncedSearch || undefined }),
    [listParams, debouncedSearch],
  );

  const equipmentQuery = usePaginatedQuery({
    queryKey: "equipment",
    params: queryParams,
    queryFn: (params) => api.listEquipment(params),
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: () => api.listCustomersOptions(),
    staleTime: 60_000,
  });

  const categoriesQuery = useQuery({
    queryKey: ["taxonomy", "equipment_category"],
    queryFn: () => api.listTaxonomy({ type: "equipment_category" }),
    staleTime: 30_000,
  });

  const conditionsQuery = useQuery({
    queryKey: ["taxonomy", "equipment_condition"],
    queryFn: () => api.listTaxonomy({ type: "equipment_condition" }),
    staleTime: 30_000,
  });

  const equipment = equipmentQuery.data?.data ?? [];
  const pagination = equipmentQuery.data?.meta ?? EMPTY_PAGINATION_META;
  const customers = (customersQuery.data ?? []).filter((c) => c.status === "active");
  const categories = categoriesQuery.data ?? [];
  const conditions = conditionsQuery.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BackendEquipment | null>(null);

  const loadEquipment = () => void queryClient.invalidateQueries({ queryKey: ["equipment"] });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (item: BackendEquipment) => {
    setEditing(item);
    setDialogOpen(true);
  };

  const columns: Column<BackendEquipment>[] = [
    {
      key: "name",
      header: "Equipment",
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-muted-foreground">
            {e.manufacturer} · {e.model}
          </p>
        </div>
      ),
    },
    {
      key: "assetTag",
      header: "Asset Tag",
      render: (e) => (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs">
          <QrCode className="h-3 w-3" /> {e.assetTag}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (e) => <span className="text-sm">{e.customerName}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (e) => <span className="text-sm text-muted-foreground">{termLabel(categories, e.category)}</span>,
    },
    {
      key: "location",
      header: "Location",
      render: (e) => <span className="text-sm text-muted-foreground">{e.location}</span>,
    },
    {
      key: "condition",
      header: "Condition",
      render: (e) => <StatusBadge status={e.condition} label={termLabel(conditions, e.condition)} />,
    },
    {
      key: "lastServiceDate",
      header: "Last Service",
      render: (e) => (
        <span className="text-sm text-muted-foreground">{formatDate(e.lastServiceDate)}</span>
      ),
    },
    ...(canManage
      ? [{
          key: "actions",
          header: "",
          className: "w-[1%] whitespace-nowrap text-right",
          render: (item: BackendEquipment) => (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation();
                openEdit(item);
              }}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          ),
        } satisfies Column<BackendEquipment>]
      : []),
  ];

  const customerFilterOptions = useMemo(
    () => customers.map((c) => ({ label: c.name, value: c.id })),
    [customers],
  );

  const categoryFilterOptions = categories.map((c) => ({ label: c.name, value: c.slug }));
  const conditionFilterOptions = conditions.map((c) => ({ label: c.name, value: c.slug }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment & Machines"
        description="QR-tracked medical devices with lifetime service history."
        actions={
          canManage ? (
            <Button
              onClick={openCreate}
              disabled={customers.length === 0}
              variant="brand"
            >
              <Plus className="mr-1 h-4 w-4" /> Add Equipment
            </Button>
          ) : undefined
        }
      />

      <DataTable
        mode="server"
        data={equipment}
        columns={columns}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, asset tag, serial, customer…"
        emptyMessage="No equipment found."
        emptyHint="Try changing your search or filters."
        filterValues={filters}
        onFilterChange={setFilter}
        filters={[
          {
            key: "condition",
            label: "Condition",
            options: conditionFilterOptions,
          },
          ...(customerFilterOptions.length > 0
            ? [{
                key: "customerId",
                label: "Customer",
                options: customerFilterOptions,
              }]
            : []),
          {
            key: "category",
            label: "Category",
            options: categoryFilterOptions,
          },
        ]}
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        loading={equipmentQuery.isLoading}
        isFetching={equipmentQuery.isFetching}
        error={equipmentQuery.error as Error | null}
        onRetry={() => loadEquipment()}
        onRowClick={(e) => navigate(`/app/equipment/${e.id}`)}
      />
      <EquipmentFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        equipment={editing}
        existingAssetTags={equipment.map((item) => item.assetTag)}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["equipment"] });
          void queryClient.invalidateQueries({ queryKey: ["customers", "options"] });
        }}
      />
    </div>
  );
}
