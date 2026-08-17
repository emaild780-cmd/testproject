import type {
  BugSeverity,
  BugPriority,
  RunStatus,
  TestCaseStatus,
  ExecutionStatus,
  TestProfile,
  TestTechnique,
  FeatureType,
  BugFailureType,
} from "@/types";

export const STATUS_COLORS: Record<RunStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  discovering: "bg-blue-100 text-blue-700 border-blue-200",
  planning: "bg-cyan-100 text-cyan-700 border-cyan-200",
  generating: "bg-cyan-100 text-cyan-700 border-cyan-200",
  executing: "bg-amber-100 text-amber-700 border-amber-200",
  validating: "bg-purple-100 text-purple-700 border-purple-200",
  reporting: "bg-indigo-100 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  cancelled: "bg-slate-100 text-slate-500 border-slate-200",
};

export const CASE_STATUS_COLORS: Record<TestCaseStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  passed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  blocked: "bg-amber-100 text-amber-700 border-amber-200",
  skipped: "bg-slate-100 text-slate-400 border-slate-200",
  error: "bg-orange-100 text-orange-700 border-orange-200",
};

export const EXEC_STATUS_COLORS: Record<ExecutionStatus, string> = {
  pending: "bg-slate-100 text-slate-600 border-slate-200",
  running: "bg-blue-100 text-blue-700 border-blue-200",
  passed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  blocked: "bg-amber-100 text-amber-700 border-amber-200",
  error: "bg-orange-100 text-orange-700 border-orange-200",
  timeout: "bg-rose-100 text-rose-700 border-rose-200",
};

export const SEVERITY_COLORS: Record<BugSeverity, string> = {
  critical: "bg-rose-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-sky-500 text-white",
};

export const PRIORITY_COLORS: Record<BugPriority, string> = {
  p0: "bg-rose-100 text-rose-700 border-rose-200",
  p1: "bg-orange-100 text-orange-700 border-orange-200",
  p2: "bg-amber-100 text-amber-700 border-amber-200",
  p3: "bg-sky-100 text-sky-700 border-sky-200",
};

export const FAILURE_TYPE_COLORS: Record<BugFailureType, string> = {
  confirmed_bug: "bg-rose-100 text-rose-700 border-rose-200",
  possible_issue: "bg-amber-100 text-amber-700 border-amber-200",
  environment_failure: "bg-slate-100 text-slate-600 border-slate-200",
  network_failure: "bg-blue-100 text-blue-700 border-blue-200",
  auth_failure: "bg-purple-100 text-purple-700 border-purple-200",
  automation_failure: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

export const PROFILE_LABELS: Record<TestProfile, string> = {
  full_qa: "Full QA",
  functional: "Functional",
  smoke: "Smoke",
  regression: "Regression",
  exploratory: "Exploratory",
  ui: "UI",
  accessibility: "Accessibility",
  performance: "Performance",
  security: "Security",
  api: "API",
};

export const PROFILE_DESCRIPTIONS: Record<TestProfile, string> = {
  full_qa: "Comprehensive testing across all dimensions — functional, UI, accessibility, performance, and security.",
  functional: "Core functionality verification — verify each feature works as intended.",
  smoke: "Quick critical-path validation — ensure key user journeys work.",
  regression: "Verify previously working features still function after changes.",
  exploratory: "AI-driven exploratory testing to discover unexpected issues.",
  ui: "Visual and layout testing across components and pages.",
  accessibility: "WCAG compliance and screen reader compatibility checks.",
  performance: "Page load times, resource usage, and responsiveness measurements.",
  security: "Basic authorized security checks — no destructive exploitation.",
  api: "API endpoint validation and response verification.",
};

export const TECHNIQUE_LABELS: Record<TestTechnique, string> = {
  functional: "Functional Testing",
  positive: "Positive Testing",
  negative: "Negative Testing",
  boundary_value: "Boundary Value Analysis",
  equivalence_partitioning: "Equivalence Partitioning",
  decision_table: "Decision Table Testing",
  state_transition: "State Transition Testing",
  end_to_end: "End-to-End Testing",
  validation: "Validation Testing",
  smoke: "Smoke Testing",
  regression: "Regression Testing",
  exploratory: "Exploratory Testing",
  ui: "UI Testing",
  accessibility: "Accessibility Testing",
  security: "Security Testing",
  performance: "Performance Testing",
};

export const FEATURE_ICONS: Record<FeatureType, string> = {
  button: "Button",
  link: "Link",
  form: "Form",
  input: "Input",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  radio: "Radio",
  table: "Table",
  modal: "Modal",
  upload: "Upload",
  download: "Download",
  navigation: "Navigation",
  image: "Image",
  text: "Text",
};

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function getQualityScoreColor(score: number | null): string {
  if (score === null) return "text-slate-400";
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-rose-600";
}

export function getQualityScoreBg(score: number | null): string {
  if (score === null) return "from-slate-400 to-slate-500";
  if (score >= 80) return "from-emerald-500 to-teal-500";
  if (score >= 60) return "from-amber-500 to-yellow-500";
  if (score >= 40) return "from-orange-500 to-amber-500";
  return "from-rose-500 to-red-500";
}
