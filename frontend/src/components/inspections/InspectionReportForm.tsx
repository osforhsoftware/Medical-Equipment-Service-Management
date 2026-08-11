import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AlertTriangle, Camera, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type BackendCatalogItem,
  type BackendInspectionReport,
  type BackendInventoryItem,
  type BackendServiceRequest,
} from "@/lib/api";
import { MobileOptionPicker } from "@/components/mobile/MobileOptionPicker";
import { cn } from "@/lib/utils";
import { InspectionSection } from "./InspectionSection";

const KIND_OPTIONS = [
  { value: "inventory", label: "Part", sublabel: "Inventory / spare part" },
  { value: "service", label: "Service", sublabel: "Catalog service line" },
  { value: "other", label: "Other", sublabel: "Custom requirement" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

const SEVERITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    helper: "Minor issue",
    dot: "bg-muted-foreground",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "Needs attention",
    dot: "bg-info",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "high",
    label: "High",
    helper: "Urgent",
    dot: "bg-warning",
    selected: "border-primary bg-primary/10 text-primary",
  },
  {
    value: "critical",
    label: "Critical",
    helper: "Immediate action",
    dot: "bg-destructive",
    selected: "border-primary bg-primary/10 text-primary",
  },
] as const;

export type RequirementKind = "inventory" | "service" | "other";

export type RequirementEntry = {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  kind: RequirementKind;
  inventoryItemId: string;
  catalogItemId: string;
  quantity: string;
};

interface InspectionReportFormProps {
  active: BackendServiceRequest;
  existingReport: BackendInspectionReport | null;
  loadingReport: boolean;
  findings: string;
  setFindings: (v: string) => void;
  recommendation: string;
  setRecommendation: (v: string) => void;
  workDetails: string;
  setWorkDetails: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  machineImages: File[];
  setMachineImages: Dispatch<SetStateAction<File[]>>;
  setMachineImage: (file: File | null) => void;
  newImagePreviews: { file: File; url: string }[];
  inventory: BackendInventoryItem[];
  serviceCatalog: BackendCatalogItem[];
  recommendedItems: RequirementEntry[];
  setRecommendedItems: Dispatch<SetStateAction<RequirementEntry[]>>;
  emptyRequirement: () => RequirementEntry;
  mobile?: boolean;
  findingsTouched?: boolean;
  setFindingsTouched?: (v: boolean) => void;
  recommendationTouched?: boolean;
  setRecommendationTouched?: (v: boolean) => void;
}

export function InspectionReportForm({
  active,
  existingReport,
  loadingReport,
  findings,
  setFindings,
  recommendation,
  setRecommendation,
  workDetails,
  setWorkDetails,
  severity,
  setSeverity,
  setMachineImages,
  setMachineImage,
  newImagePreviews,
  inventory,
  serviceCatalog,
  recommendedItems,
  setRecommendedItems,
  emptyRequirement,
  mobile = false,
  findingsTouched = false,
  setFindingsTouched,
  recommendationTouched = false,
  setRecommendationTouched,
}: InspectionReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [localFindingsTouched, setLocalFindingsTouched] = useState(false);
  const [localRecommendationTouched, setLocalRecommendationTouched] = useState(false);

  const findingsIsTouched = findingsTouched || localFindingsTouched;
  const recommendationIsTouched = recommendationTouched || localRecommendationTouched;

  const markFindingsTouched = () => {
    setLocalFindingsTouched(true);
    setFindingsTouched?.(true);
  };
  const markRecommendationTouched = () => {
    setLocalRecommendationTouched(true);
    setRecommendationTouched?.(true);
  };

  const equipmentLabel = active.equipmentItems?.length
    ? active.equipmentItems.map((e) => e.equipmentName).join(", ")
    : (active.equipmentName ?? "Equipment");

  const hasExistingPhotos = Boolean(existingReport?.attachments?.length);
  const hasNewPhotos = newImagePreviews.length > 0;
  const photosRequired = !hasExistingPhotos;
  const photosMissing = photosRequired && !hasNewPhotos;
  const findingsError =
    findingsIsTouched && findings.trim().length > 0 && findings.trim().length < 10
      ? "Enter at least 10 characters."
      : findingsIsTouched && !findings.trim()
        ? "Findings are required."
        : null;
  const recommendationError =
    recommendationIsTouched && !recommendation.trim() ? "Recommendation is required." : null;

  const appendFiles = (files: File[]) => {
    if (!files.length) return;
    setMachineImages((prev) => {
      const next = [...prev, ...files];
      setMachineImage(next[0] ?? null);
      return next;
    });
  };

  const removeNewImage = (index: number) => {
    setMachineImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setMachineImage(next[0] ?? null);
      return next;
    });
  };

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading existing report…
      </div>
    );
  }

  const inventoryOptions = inventory.map((inv) => ({
    value: inv.id,
    label: inv.name,
    sublabel: inv.sku,
    stock: Math.max(0, inv.inStock - inv.reserved),
  }));

  const serviceOptions = serviceCatalog.map((svc) => ({
    value: svc.id,
    label: svc.name,
    sublabel: `${svc.code} · ${svc.unit}`,
  }));

  const selectContentClass = "max-h-[min(60dvh,320px)] max-sm:min-w-[min(calc(100vw-2rem),22rem)]";
  const selectItemClass = "items-start whitespace-normal py-3 pl-8 pr-3";

  return (
    <div className={cn("space-y-6", mobile && "pb-2")}>
      {existingReport ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-warning-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Updating report filed by <strong>{existingReport.reportedBy}</strong>
          </p>
        </div>
      ) : null}

      <InspectionSection
        step="01"
        title="Severity"
        description="How serious is the issue?"
        required
      >
        <div
          className={cn("grid grid-cols-2 gap-2", !mobile && "sm:grid-cols-4")}
          role="radiogroup"
          aria-label="Severity level"
        >
          {SEVERITY_OPTIONS.map((opt) => {
            const selected = severity === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSeverity(opt.value)}
                className={cn(
                  "flex min-h-[48px] flex-col items-start justify-center gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200",
                  selected
                    ? opt.selected
                    : "border-border/70 bg-card text-foreground hover:bg-muted/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", opt.dot)} aria-hidden="true" />
                  {opt.label}
                </span>
                <span className="pl-4 text-[11px] text-muted-foreground">{opt.helper}</span>
              </button>
            );
          })}
        </div>
      </InspectionSection>

      <InspectionSection
        step="02"
        title="Findings & Observations"
        description="Describe what you observed during the inspection."
        required
      >
        <div className="space-y-2">
          <Label htmlFor="findings" className="sr-only">
            Findings & Observations
          </Label>
          <Textarea
            id="findings"
            value={findings}
            onChange={(e) => setFindings(e.target.value.slice(0, 500))}
            onBlur={markFindingsTouched}
            rows={mobile ? 5 : 4}
            aria-invalid={Boolean(findingsError)}
            aria-describedby="findings-hint"
            className={cn(
              mobile && "min-h-[120px] resize-none rounded-xl text-base leading-relaxed",
              findingsError && "border-destructive focus-visible:ring-destructive",
            )}
            placeholder="Describe the issue, condition, or abnormal behavior…"
          />
          <div id="findings-hint" className="flex items-center justify-between gap-2 text-xs">
            <span className={cn(findingsError ? "text-destructive" : "text-muted-foreground")}>
              {findingsError ?? "Minimum 10 characters"}
            </span>
            <span className="tabular-nums text-muted-foreground">{findings.length} / 500</span>
          </div>
        </div>
      </InspectionSection>

      <InspectionSection
        title="Work Details"
        description="Add any work already performed during the inspection."
        optional
        className="opacity-95"
      >
        <Textarea
          id="workDetails"
          value={workDetails}
          onChange={(e) => setWorkDetails(e.target.value)}
          rows={mobile ? 3 : 2}
          className={cn(mobile && "min-h-[88px] resize-none rounded-xl text-base leading-relaxed")}
          placeholder="Tests performed, measurements, error codes…"
        />
      </InspectionSection>

      <InspectionSection
        step="03"
        title="Inspection Photos"
        description={
          photosMissing
            ? "Photos are required before submitting this report."
            : `${equipmentLabel} — attach clear photos of the equipment and any faults.`
        }
        required={photosRequired}
        tone={photosMissing ? "warning" : "default"}
      >
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => {
            appendFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            appendFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {mobile ? (
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="mobile-btn-primary !h-12 gap-2 text-sm"
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
              Take Photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mobile-btn-secondary !h-12 gap-2 text-sm"
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Choose from Gallery
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
              photosMissing
                ? "border-warning/50 bg-warning/5 hover:bg-warning/10"
                : "border-border/70 bg-muted/20 hover:bg-muted/40",
            )}
          >
            <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-foreground">Add inspection photos</p>
              <p className="mt-0.5 text-xs text-muted-foreground">JPG, PNG · Multiple images</p>
            </div>
          </button>
        )}

        {(hasExistingPhotos || hasNewPhotos) && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {existingReport?.attachments?.map((att) => (
              <a
                key={att.id}
                href={api.fileDownloadUrl(att.fileId)}
                target="_blank"
                rel="noreferrer"
                className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted"
                title={att.file?.originalName ?? att.fileId}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={api.fileDownloadUrl(att.fileId)}
                  alt={att.file?.originalName ?? "Inspection image"}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
            {newImagePreviews.map(({ file, url }, index) => (
              <div
                key={`${file.name}-${file.lastModified}`}
                className="relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted"
              >
                <img src={url} alt={file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeNewImage(index)}
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/70 text-background"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {!mobile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted/40"
                aria-label="Add more photos"
              >
                <Plus className="h-5 w-5" />
                <span className="text-[11px] font-medium">Add</span>
              </button>
            ) : null}
          </div>
        )}

        {hasNewPhotos ? (
          <p className="mt-2 text-xs font-medium text-primary">
            {newImagePreviews.length} new photo{newImagePreviews.length === 1 ? "" : "s"} ready to upload
          </p>
        ) : null}
      </InspectionSection>

      <InspectionSection
        step="04"
        title="Recommendation"
        description="What should happen next?"
        required
      >
        <div className="space-y-2">
          <Label htmlFor="recommendation" className="sr-only">
            Recommendation
          </Label>
          <Textarea
            id="recommendation"
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            onBlur={markRecommendationTouched}
            rows={mobile ? 4 : 3}
            aria-invalid={Boolean(recommendationError)}
            aria-describedby="recommendation-hint"
            className={cn(
              mobile && "min-h-[96px] resize-none rounded-xl text-base leading-relaxed",
              recommendationError && "border-destructive focus-visible:ring-destructive",
            )}
            placeholder="e.g. Replace compressor filter and schedule follow-up calibration…"
          />
          <p
            id="recommendation-hint"
            className={cn("text-xs", recommendationError ? "text-destructive" : "text-muted-foreground")}
          >
            {recommendationError ?? "Provide a concise professional recommendation."}
          </p>
        </div>
      </InspectionSection>

      <InspectionSection
        step="05"
        title="Parts & Service Requirements"
        description="Add required materials or work for the estimate stage."
        optional
      >
        <div className="space-y-3">
          {recommendedItems.map((item, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl border border-border/60 bg-card p-3"
            >
              <div className={cn("grid gap-2", mobile ? "grid-cols-1" : "grid-cols-[110px_1fr_80px_110px_auto]")}>
                {mobile ? (
                  <MobileOptionPicker
                    label="Requirement type"
                    value={item.kind}
                    options={[...KIND_OPTIONS]}
                    onChange={(kind) => {
                      setRecommendedItems((items) =>
                        items.map((entry, i) =>
                          i === index
                            ? {
                                ...entry,
                                kind: kind as RequirementKind,
                                inventoryItemId: "",
                                catalogItemId: "",
                                title: kind === "other" ? entry.title : "",
                              }
                            : entry,
                        ),
                      );
                    }}
                  />
                ) : (
                  <Select
                    value={item.kind}
                    onValueChange={(kind: RequirementKind) => {
                      setRecommendedItems((items) =>
                        items.map((entry, i) =>
                          i === index
                            ? {
                                ...entry,
                                kind,
                                inventoryItemId: "",
                                catalogItemId: "",
                                title: kind === "other" ? entry.title : "",
                              }
                            : entry,
                        ),
                      );
                    }}
                  >
                    <SelectTrigger aria-label="Requirement type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <SelectItem value="inventory">Part</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}

                {item.kind === "inventory" ? (
                  mobile ? (
                    <MobileOptionPicker
                      label="Select inventory item"
                      placeholder="Select inventory item"
                      value={item.inventoryItemId}
                      options={inventoryOptions}
                      searchable
                      searchPlaceholder="Search parts by name or SKU…"
                      onChange={(inventoryItemId) => {
                        const inv = inventory.find((i) => i.id === inventoryItemId);
                        setRecommendedItems((items) =>
                          items.map((entry, i) =>
                            i === index
                              ? { ...entry, inventoryItemId, title: inv?.name ?? entry.title }
                              : entry,
                          ),
                        );
                      }}
                    />
                  ) : (
                    <Select
                      value={item.inventoryItemId || undefined}
                      onValueChange={(inventoryItemId) => {
                        const inv = inventory.find((i) => i.id === inventoryItemId);
                        setRecommendedItems((items) =>
                          items.map((entry, i) =>
                            i === index
                              ? { ...entry, inventoryItemId, title: inv?.name ?? entry.title }
                              : entry,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select inventory item" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {inventory.map((inv) => {
                          const avail = Math.max(0, inv.inStock - inv.reserved);
                          return (
                            <SelectItem key={inv.id} value={inv.id} className={selectItemClass}>
                              <span className="flex flex-col gap-0.5">
                                <span className="font-medium leading-snug">{inv.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {inv.sku} · {avail === 0 ? "Out of stock" : `${avail} available`}
                                </span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )
                ) : item.kind === "service" ? (
                  mobile ? (
                    <MobileOptionPicker
                      label="Select service"
                      placeholder="Select service"
                      value={item.catalogItemId}
                      options={serviceOptions}
                      searchable
                      searchPlaceholder="Search services…"
                      onChange={(catalogItemId) => {
                        const svc = serviceCatalog.find((s) => s.id === catalogItemId);
                        setRecommendedItems((items) =>
                          items.map((entry, i) =>
                            i === index
                              ? { ...entry, catalogItemId, title: svc?.name ?? entry.title }
                              : entry,
                          ),
                        );
                      }}
                    />
                  ) : (
                    <Select
                      value={item.catalogItemId || undefined}
                      onValueChange={(catalogItemId) => {
                        const svc = serviceCatalog.find((s) => s.id === catalogItemId);
                        setRecommendedItems((items) =>
                          items.map((entry, i) =>
                            i === index
                              ? { ...entry, catalogItemId, title: svc?.name ?? entry.title }
                              : entry,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select service" />
                      </SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {serviceCatalog.map((svc) => (
                          <SelectItem key={svc.id} value={svc.id} className={selectItemClass}>
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium leading-snug">{svc.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {svc.code} · {svc.unit}
                              </span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )
                ) : (
                  <Input
                    value={item.title}
                    onChange={(event) =>
                      setRecommendedItems((items) =>
                        items.map((entry, i) => (i === index ? { ...entry, title: event.target.value } : entry)),
                      )
                    }
                    placeholder="Describe other requirement"
                    className={cn(mobile && "h-12 rounded-xl text-base")}
                  />
                )}

                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    setRecommendedItems((items) =>
                      items.map((entry, i) => (i === index ? { ...entry, quantity: event.target.value } : entry)),
                    )
                  }
                  placeholder="Qty"
                  aria-label="Quantity"
                  className={cn(mobile && "h-12 rounded-xl text-base")}
                />

                {mobile ? (
                  <MobileOptionPicker
                    label="Priority"
                    value={item.priority}
                    options={[...PRIORITY_OPTIONS]}
                    onChange={(priority) => {
                      setRecommendedItems((items) =>
                        items.map((entry, i) =>
                          i === index
                            ? { ...entry, priority: priority as RequirementEntry["priority"] }
                            : entry,
                        ),
                      );
                    }}
                  />
                ) : (
                  <Select
                    value={item.priority}
                    onValueChange={(priority: RequirementEntry["priority"]) => {
                      setRecommendedItems((items) =>
                        items.map((entry, i) => (i === index ? { ...entry, priority } : entry)),
                      );
                    }}
                  >
                    <SelectTrigger aria-label="Priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn(mobile && "h-12 w-12 shrink-0 rounded-xl")}
                  onClick={() => setRecommendedItems((items) => items.filter((_, i) => i !== index))}
                  disabled={recommendedItems.length === 1}
                  aria-label="Remove requirement"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={item.description}
                onChange={(event) =>
                  setRecommendedItems((items) =>
                    items.map((entry, i) => (i === index ? { ...entry, description: event.target.value } : entry)),
                  )
                }
                rows={2}
                className={cn(mobile && "min-h-[72px] resize-none rounded-xl text-base")}
                placeholder={item.kind === "other" ? "Details for this requirement…" : "Why needed…"}
              />
            </div>
          ))}

          <Button
            type="button"
            size={mobile ? "default" : "sm"}
            variant="outline"
            className={cn(mobile && "h-11 w-full rounded-xl")}
            onClick={() => setRecommendedItems((items) => [...items, emptyRequirement()])}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add requirement
          </Button>
        </div>
      </InspectionSection>
    </div>
  );
}
