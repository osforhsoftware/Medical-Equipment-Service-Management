import { ServiceJobDetail } from "./JobDetail";

/** Project detail is the full service job hub (workflow, reports, activity, edit) plus team staffing. */
export default function ProjectDetail() {
  return <ServiceJobDetail variant="project" />;
}
