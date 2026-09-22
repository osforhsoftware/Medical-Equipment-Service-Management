import {
  SavedViewsSidebar,
  JOBS_SAVED_VIEWS,
  parseSavedView,
  type SavedViewKey,
} from "@/components/shared/SavedViewsSidebar";

export type JobsSavedView = SavedViewKey;
export const parseJobsSavedView = parseSavedView;

type JobsSavedViewsSidebarProps = {
  value: JobsSavedView;
  onChange: (next: JobsSavedView) => void;
  className?: string;
};

export function JobsSavedViewsSidebar({ value, onChange, className }: JobsSavedViewsSidebarProps) {
  return (
    <SavedViewsSidebar
      value={value}
      onChange={onChange}
      items={JOBS_SAVED_VIEWS}
      ariaLabel="Saved job views"
      className={className}
    />
  );
}
