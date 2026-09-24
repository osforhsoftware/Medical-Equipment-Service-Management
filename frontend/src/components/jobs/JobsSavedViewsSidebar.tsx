import {
  SavedViewsSidebar,
  JOBS_SAVED_VIEWS,
  JOBS_QA_SAVED_VIEWS,
  parseSavedView,
  type SavedViewKey,
} from "@/components/shared/SavedViewsSidebar";

export type JobsSavedView = SavedViewKey;
export const parseJobsSavedView = parseSavedView;

type JobsSavedViewsSidebarProps = {
  value: JobsSavedView;
  onChange: (next: JobsSavedView) => void;
  className?: string;
  /** When true, show QA pending / completed history panels instead of generic job views. */
  qaMode?: boolean;
};

export function JobsSavedViewsSidebar({ value, onChange, className, qaMode = false }: JobsSavedViewsSidebarProps) {
  return (
    <SavedViewsSidebar
      value={value}
      onChange={onChange}
      items={qaMode ? JOBS_QA_SAVED_VIEWS : JOBS_SAVED_VIEWS}
      ariaLabel={qaMode ? "QA work views" : "Saved job views"}
      className={className}
    />
  );
}
