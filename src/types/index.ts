export type RunStatus =
  | "pending"
  | "discovering"
  | "planning"
  | "generating"
  | "executing"
  | "validating"
  | "reporting"
  | "completed"
  | "failed"
  | "cancelled";

export type TestCaseStatus = "pending" | "passed" | "failed" | "blocked" | "skipped" | "error";

export type ExecutionStatus = "pending" | "running" | "passed" | "failed" | "blocked" | "error" | "timeout";

export type BugSeverity = "critical" | "high" | "medium" | "low";

export type BugPriority = "p0" | "p1" | "p2" | "p3";

export type BugReproductionStatus =
  | "unconfirmed"
  | "reproduced"
  | "confirmed"
  | "not_reproduced"
  | "flaky";

export type BugFailureType =
  | "confirmed_bug"
  | "possible_issue"
  | "environment_failure"
  | "network_failure"
  | "auth_failure"
  | "automation_failure";

export type TestProfile =
  | "full_qa"
  | "functional"
  | "smoke"
  | "regression"
  | "exploratory"
  | "ui"
  | "accessibility"
  | "performance"
  | "security"
  | "api";

export type TargetType = "website" | "mobile";

export type Environment = "development" | "staging" | "production";

export type FeatureType =
  | "button"
  | "link"
  | "form"
  | "input"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "table"
  | "modal"
  | "upload"
  | "download"
  | "navigation"
  | "image"
  | "text";

export type TestTechnique =
  | "functional"
  | "positive"
  | "negative"
  | "boundary_value"
  | "equivalence_partitioning"
  | "decision_table"
  | "state_transition"
  | "end_to_end"
  | "validation"
  | "smoke"
  | "regression"
  | "exploratory"
  | "ui"
  | "accessibility"
  | "security"
  | "performance";

export type EvidenceType =
  | "screenshot"
  | "console_log"
  | "network_log"
  | "dom_snapshot"
  | "video"
  | "har"
  | "error_stack";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Target {
  id: string;
  project_id: string;
  type: TargetType;
  url: string | null;
  platform: string;
  file_name: string | null;
  file_size: number | null;
  environment: Environment;
  auth_required: boolean;
  auth_username: string | null;
  auth_password: string | null;
  notes: string | null;
  created_at: string;
}

export interface TestConfiguration {
  id: string;
  project_id: string;
  name: string;
  profile: TestProfile;
  max_pages: number;
  max_test_cases: number;
  crawl_depth: number;
  rate_limit_ms: number;
  timeout_ms: number;
  screenshot_on_failure: boolean;
  capture_console: boolean;
  capture_network: boolean;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface TestRun {
  id: string;
  project_id: string;
  target_id: string;
  config_id: string;
  status: RunStatus;
  current_phase: string | null;
  progress: number;
  quality_score: number | null;
  total_test_cases: number;
  passed: number;
  failed: number;
  blocked: number;
  bugs_confirmed: number;
  bugs_possible: number;
  coverage_percentage: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  targets?: Target;
  test_configurations?: TestConfiguration;
}

export interface AppPage {
  id: string;
  run_id: string;
  url: string;
  title: string | null;
  depth: number;
  status: "discovered" | "tested" | "failed" | "skipped";
  status_code: number | null;
  load_time_ms: number | null;
  console_errors: number;
  network_errors: number;
  discovered_at: string;
}

export interface Feature {
  id: string;
  run_id: string;
  page_id: string;
  type: FeatureType;
  selector: string | null;
  label: string | null;
  attributes: Record<string, unknown>;
  tested: boolean;
  discovered_at: string;
}

export interface TestCase {
  id: string;
  run_id: string;
  scenario_id: string | null;
  page_id: string | null;
  feature_id: string | null;
  case_id: string | null;
  module_page: string;
  scenario: string;
  technique: TestTechnique;
  preconditions: string | null;
  test_data: Record<string, unknown>;
  steps: { action: string; target: string; expected: string }[];
  expected_result: string;
  actual_result: string | null;
  status: TestCaseStatus;
  bug_id: string | null;
  created_at: string;
}

export interface Execution {
  id: string;
  test_case_id: string;
  run_id: string;
  status: ExecutionStatus;
  attempt: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  logs: unknown[];
  console_errors: unknown[];
  network_errors: unknown[];
  created_at: string;
}

export interface Evidence {
  id: string;
  execution_id: string;
  run_id: string;
  type: EvidenceType;
  label: string | null;
  url: string | null;
  file_path: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  captured_at: string;
}

export interface Bug {
  id: string;
  run_id: string;
  test_case_id: string | null;
  bug_id: string | null;
  title: string;
  module: string | null;
  url: string | null;
  severity: BugSeverity;
  priority: BugPriority;
  preconditions: string | null;
  steps_to_reproduce: { action: string; target: string; expected: string }[];
  expected_result: string | null;
  actual_result: string | null;
  environment: string | null;
  evidence: unknown[];
  reproduction_status: BugReproductionStatus;
  failure_type: BugFailureType;
  root_cause: string | null;
  dedup_hash: string | null;
  created_at: string;
}

export interface Coverage {
  id: string;
  run_id: string;
  pages_discovered: number;
  pages_tested: number;
  features_discovered: number;
  features_tested: number;
  workflows_discovered: number;
  workflows_tested: number;
  test_cases_generated: number;
  test_cases_executed: number;
  passed: number;
  failed: number;
  blocked: number;
  coverage_percentage: number;
  untested_areas: { url: string; title: string; reason: string }[];
  techniques_used: string[];
  created_at: string;
}

export interface Report {
  id: string;
  run_id: string;
  type: "full" | "executive" | "bug" | "coverage";
  format: "json" | "pdf" | "csv";
  data: Record<string, unknown>;
  generated_at: string;
}
