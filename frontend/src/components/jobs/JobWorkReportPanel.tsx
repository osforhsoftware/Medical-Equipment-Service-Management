import { ClipboardList, Loader2, MapPin, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import type { BackendJobPhoto, BackendJobWorkLog, BackendServiceJob } from "@/lib/api";
import { formatJobStatus } from "@/lib/format";
import { JobWorkReportForm } from "./JobWorkReportForm";

interface JobWorkReportPanelProps {
  open: boolean;
  onClose: () => void;
  job: BackendServiceJob | null;
  existingLog: BackendJobWorkLog | null;
  existingPhotos: BackendJobPhoto[];
  saving: boolean;
  onSubmit: () => void;
  workPerformed: string;
  setWorkPerformed: (v: string) => void;
  testingResult: string;
  setTestingResult: (v: string) => void;
  calibrationResult: string;
  setCalibrationResult: (v: string) => void;
  recommendation: string;
  setRecommendation: (v: string) => void;
  setNewImages: React.Dispatch<React.SetStateAction<File[]>>;
  imageCaptions: string[];
  setImageCaptions: React.Dispatch<React.SetStateAction<string[]>>;
  newImagePreviews: { file: File; url: string }[];
}

export function JobWorkReportPanel(props: JobWorkReportPanelProps) {
  const isMobile = useIsMobile();
  const {
    open,
    onClose,
    job,
    existingLog,
    existingPhotos,
    saving,
    onSubmit,
    ...formProps
  } = props;

  if (!job) return null;

  const title = existingLog ? "Update Work Report" : "Work Report";
  const submitLabel = existingLog ? "Update Report" : "Save Report";

  const form = (
    <JobWorkReportForm
      job={job}
      existingLog={existingLog}
      existingPhotos={existingPhotos}
      mobile={isMobile}
      {...formProps}
    />
  );

  const submitButton = (
    <Button
      variant="brand"
      className={isMobile ? "mobile-btn-primary w-full" : "min-w-[140px]"}
      onClick={onSubmit}
      disabled={saving}
    >
      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-1 h-4 w-4" />}
      {saving ? "Saving…" : submitLabel}
    </Button>
  );

  const cancelButton = (
    <Button
      variant="outline"
      className={isMobile ? "mobile-btn-secondary w-full" : ""}
      onClick={onClose}
      disabled={saving}
    >
      Cancel
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && !saving && onClose()}>
        <DrawerContent className="mobile-inspection-sheet [&>div:first-child]:hidden">
          <div className="shrink-0 border-b border-border/60 bg-card px-4 pb-3 pt-safe">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pt-1">
                <DrawerTitle className="text-lg font-semibold leading-tight">{title}</DrawerTitle>
                <p className="mt-1 truncate text-sm font-medium text-foreground">{job.equipmentName}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {job.reference} · {job.customerName}
                </p>
                <div className="mt-2">
                  <StatusBadge status={formatJobStatus(job.status)} />
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mobile-icon-btn shrink-0"
                aria-label="Close"
                disabled={saving}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">{form}</div>
          <div className="shrink-0 space-y-2 border-t border-border/60 bg-card/95 px-4 py-3 pb-safe backdrop-blur-xl">
            {submitButton}
            {cancelButton}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-6 py-5 pr-12 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
              <DialogDescription className="mt-1.5 text-sm text-foreground/80">
                <span className="font-medium text-foreground">{job.equipmentName}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {job.reference} · {job.customerName}
                </span>
              </DialogDescription>
            </div>
            <StatusBadge status={formatJobStatus(job.status)} className="shrink-0" />
          </div>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-muted-foreground">Customer</p>
              <p className="mt-0.5 truncate font-medium text-foreground">{job.customerName}</p>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-muted-foreground">
                <User className="h-3 w-3" aria-hidden="true" />
                Engineer
              </p>
              <p className="mt-0.5 truncate font-medium text-foreground">{job.engineer}</p>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                Ticket
              </p>
              <p className="mt-0.5 truncate font-mono font-medium text-foreground">{job.requestRef}</p>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-5">{form}</div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-card px-6 py-4 sm:justify-between">
          {cancelButton}
          {submitButton}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
