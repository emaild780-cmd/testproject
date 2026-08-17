/*
# AI Autonomous QA Testing Platform - Core Schema

1. Overview
This migration creates the complete data model for an AI-powered QA testing platform.
The platform discovers websites, generates test cases via AI, executes them with Playwright,
validates failures into confirmed bugs, captures evidence, calculates coverage, and generates reports.

Traceability chain: Feature → Technique → Test Case → Execution → Evidence → Bug

2. New Tables (in dependency order)
- `projects`: Top-level test projects.
- `targets`: The application under test (website URL or mobile app file).
- `test_configurations`: Test profile settings (Full QA, Smoke, Regression, etc.).
- `test_runs`: A single execution of a config against a target. Tracks status, phase, quality score.
- `app_pages`: Pages/screens discovered during the discovery phase.
- `features`: Individual interactive elements discovered on a page.
- `test_scenarios`: AI-generated test scenarios grouping related test cases.
- `bugs`: Confirmed or suspected defects with full bug report fields.
- `test_cases`: Individual test cases with steps, expected results, status. Links to bugs.
- `executions`: Actual execution record of a test case.
- `evidence`: Captured evidence (screenshots, console/network logs, DOM snapshots).
- `coverage`: Aggregated coverage metrics per run.
- `reports`: Generated report metadata and data per run.

3. Security
- Single-tenant application (no sign-in screen). All tables use `TO anon, authenticated` policies.
- RLS enabled on every table. Four separate CRUD policies per table.

4. Notes
- All tables use gen_random_uuid() PKs, timestamps default now().
- JSONB columns for flexible structured data.
- Foreign keys cascade on delete.
*/

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_projects" ON projects;
CREATE POLICY "anon_select_projects" ON projects FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_projects" ON projects;
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_projects" ON projects;
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_projects" ON projects;
CREATE POLICY "anon_delete_projects" ON projects FOR DELETE TO anon, authenticated USING (true);

-- TARGETS
CREATE TABLE IF NOT EXISTS targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'website' CHECK (type IN ('website', 'mobile')),
  url text,
  platform text DEFAULT 'android' CHECK (platform IN ('android', 'ios')),
  file_name text,
  file_size bigint,
  environment text DEFAULT 'staging' CHECK (environment IN ('development', 'staging', 'production')),
  auth_required boolean DEFAULT false,
  auth_username text,
  auth_password text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_targets_project ON targets(project_id);
DROP POLICY IF EXISTS "anon_select_targets" ON targets;
CREATE POLICY "anon_select_targets" ON targets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_targets" ON targets;
CREATE POLICY "anon_insert_targets" ON targets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_targets" ON targets;
CREATE POLICY "anon_update_targets" ON targets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_targets" ON targets;
CREATE POLICY "anon_delete_targets" ON targets FOR DELETE TO anon, authenticated USING (true);

-- TEST CONFIGURATIONS
CREATE TABLE IF NOT EXISTS test_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Full QA',
  profile text NOT NULL DEFAULT 'full_qa' CHECK (profile IN ('full_qa', 'functional', 'smoke', 'regression', 'exploratory', 'ui', 'accessibility', 'performance', 'security', 'api')),
  max_pages integer DEFAULT 20,
  max_test_cases integer DEFAULT 50,
  crawl_depth integer DEFAULT 2,
  rate_limit_ms integer DEFAULT 500,
  timeout_ms integer DEFAULT 30000,
  screenshot_on_failure boolean DEFAULT true,
  capture_console boolean DEFAULT true,
  capture_network boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE test_configurations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_test_configs_project ON test_configurations(project_id);
DROP POLICY IF EXISTS "anon_select_test_configs" ON test_configurations;
CREATE POLICY "anon_select_test_configs" ON test_configurations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_test_configs" ON test_configurations;
CREATE POLICY "anon_insert_test_configs" ON test_configurations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_test_configs" ON test_configurations;
CREATE POLICY "anon_update_test_configs" ON test_configurations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_test_configs" ON test_configurations;
CREATE POLICY "anon_delete_test_configs" ON test_configurations FOR DELETE TO anon, authenticated USING (true);

-- TEST RUNS
CREATE TABLE IF NOT EXISTS test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES test_configurations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'discovering', 'planning', 'generating', 'executing', 'validating', 'reporting', 'completed', 'failed', 'cancelled')),
  current_phase text,
  progress integer DEFAULT 0,
  quality_score integer,
  total_test_cases integer DEFAULT 0,
  passed integer DEFAULT 0,
  failed integer DEFAULT 0,
  blocked integer DEFAULT 0,
  bugs_confirmed integer DEFAULT 0,
  bugs_possible integer DEFAULT 0,
  coverage_percentage numeric(5,2) DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_runs_project ON test_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON test_runs(status);
DROP POLICY IF EXISTS "anon_select_runs" ON test_runs;
CREATE POLICY "anon_select_runs" ON test_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_runs" ON test_runs;
CREATE POLICY "anon_insert_runs" ON test_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_runs" ON test_runs;
CREATE POLICY "anon_update_runs" ON test_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_runs" ON test_runs;
CREATE POLICY "anon_delete_runs" ON test_runs FOR DELETE TO anon, authenticated USING (true);

-- APP PAGES
CREATE TABLE IF NOT EXISTS app_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text,
  depth integer DEFAULT 0,
  status text DEFAULT 'discovered' CHECK (status IN ('discovered', 'tested', 'failed', 'skipped')),
  status_code integer,
  load_time_ms integer,
  console_errors integer DEFAULT 0,
  network_errors integer DEFAULT 0,
  discovered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_pages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pages_run ON app_pages(run_id);
DROP POLICY IF EXISTS "anon_select_pages" ON app_pages;
CREATE POLICY "anon_select_pages" ON app_pages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pages" ON app_pages;
CREATE POLICY "anon_insert_pages" ON app_pages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pages" ON app_pages;
CREATE POLICY "anon_update_pages" ON app_pages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pages" ON app_pages;
CREATE POLICY "anon_delete_pages" ON app_pages FOR DELETE TO anon, authenticated USING (true);

-- FEATURES
CREATE TABLE IF NOT EXISTS features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES app_pages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('button', 'link', 'form', 'input', 'dropdown', 'checkbox', 'radio', 'table', 'modal', 'upload', 'download', 'navigation', 'image', 'text')),
  selector text,
  label text,
  attributes jsonb DEFAULT '{}'::jsonb,
  tested boolean DEFAULT false,
  discovered_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_features_run ON features(run_id);
CREATE INDEX IF NOT EXISTS idx_features_page ON features(page_id);
DROP POLICY IF EXISTS "anon_select_features" ON features;
CREATE POLICY "anon_select_features" ON features FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_features" ON features;
CREATE POLICY "anon_insert_features" ON features FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_features" ON features;
CREATE POLICY "anon_update_features" ON features FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_features" ON features;
CREATE POLICY "anon_delete_features" ON features FOR DELETE TO anon, authenticated USING (true);

-- TEST SCENARIOS
CREATE TABLE IF NOT EXISTS test_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  feature_id uuid REFERENCES features(id) ON DELETE SET NULL,
  page_id uuid REFERENCES app_pages(id) ON DELETE SET NULL,
  technique text NOT NULL CHECK (technique IN ('functional', 'positive', 'negative', 'boundary_value', 'equivalence_partitioning', 'decision_table', 'state_transition', 'end_to_end', 'validation', 'smoke', 'regression', 'exploratory', 'ui', 'accessibility', 'security', 'performance')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE test_scenarios ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_scenarios_run ON test_scenarios(run_id);
DROP POLICY IF EXISTS "anon_select_scenarios" ON test_scenarios;
CREATE POLICY "anon_select_scenarios" ON test_scenarios FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_scenarios" ON test_scenarios;
CREATE POLICY "anon_insert_scenarios" ON test_scenarios FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_scenarios" ON test_scenarios;
CREATE POLICY "anon_update_scenarios" ON test_scenarios FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_scenarios" ON test_scenarios;
CREATE POLICY "anon_delete_scenarios" ON test_scenarios FOR DELETE TO anon, authenticated USING (true);

-- BUGS (before test_cases, since test_cases references bugs)
CREATE TABLE IF NOT EXISTS bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id uuid,
  bug_id text,
  title text NOT NULL,
  module text,
  url text,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('p0', 'p1', 'p2', 'p3')),
  preconditions text,
  steps_to_reproduce jsonb DEFAULT '[]'::jsonb,
  expected_result text,
  actual_result text,
  environment text,
  evidence jsonb DEFAULT '[]'::jsonb,
  reproduction_status text DEFAULT 'unconfirmed' CHECK (reproduction_status IN ('unconfirmed', 'reproduced', 'confirmed', 'not_reproduced', 'flaky')),
  failure_type text DEFAULT 'confirmed_bug' CHECK (failure_type IN ('confirmed_bug', 'possible_issue', 'environment_failure', 'network_failure', 'auth_failure', 'automation_failure')),
  root_cause text,
  dedup_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bugs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_bugs_run ON bugs(report_id);
CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
DROP POLICY IF EXISTS "anon_select_bugs" ON bugs;
CREATE POLICY "anon_select_bugs" ON bugs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_bugs" ON bugs;
CREATE POLICY "anon_insert_bugs" ON bugs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_bugs" ON bugs;
CREATE POLICY "anon_update_bugs" ON bugs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_bugs" ON bugs;
CREATE POLICY "anon_delete_bugs" ON bugs FOR DELETE TO anon, authenticated USING (true);

-- TEST CASES
CREATE TABLE IF NOT EXISTS test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES test_scenarios(id) ON DELETE SET NULL,
  page_id uuid REFERENCES app_pages(id) ON DELETE SET NULL,
  feature_id uuid REFERENCES features(id) ON DELETE SET NULL,
  case_id text,
  module_page text NOT NULL,
  scenario text NOT NULL,
  technique text NOT NULL,
  preconditions text,
  test_data jsonb DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_result text NOT NULL,
  actual_result text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'blocked', 'skipped', 'error')),
  bug_id uuid REFERENCES bugs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cases_run ON test_cases(run_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON test_cases(status);
DROP POLICY IF EXISTS "anon_select_cases" ON test_cases;
CREATE POLICY "anon_select_cases" ON test_cases FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cases" ON test_cases;
CREATE POLICY "anon_insert_cases" ON test_cases FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cases" ON test_cases;
CREATE POLICY "anon_update_cases" ON test_cases FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cases" ON test_cases;
CREATE POLICY "anon_delete_cases" ON test_cases FOR DELETE TO anon, authenticated USING (true);

-- Now add FK from bugs.test_case_id to test_cases (created after bugs)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'bugs_test_case_id_fkey' AND table_name = 'bugs'
  ) THEN
    ALTER TABLE bugs ADD CONSTRAINT bugs_test_case_id_fkey
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- EXECUTIONS
CREATE TABLE IF NOT EXISTS executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id uuid NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'passed', 'failed', 'blocked', 'error', 'timeout')),
  attempt integer DEFAULT 1,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  logs jsonb DEFAULT '[]'::jsonb,
  console_errors jsonb DEFAULT '[]'::jsonb,
  network_errors jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_exec_case ON executions(test_case_id);
CREATE INDEX IF NOT EXISTS idx_exec_run ON executions(run_id);
DROP POLICY IF EXISTS "anon_select_executions" ON executions;
CREATE POLICY "anon_select_executions" ON executions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_executions" ON executions;
CREATE POLICY "anon_insert_executions" ON executions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_executions" ON executions;
CREATE POLICY "anon_update_executions" ON executions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_executions" ON executions;
CREATE POLICY "anon_delete_executions" ON executions FOR DELETE TO anon, authenticated USING (true);

-- EVIDENCE
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('screenshot', 'console_log', 'network_log', 'dom_snapshot', 'video', 'har', 'error_stack')),
  label text,
  url text,
  file_path text,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_evidence_exec ON evidence(execution_id);
CREATE INDEX IF NOT EXISTS idx_evidence_run ON evidence(run_id);
DROP POLICY IF EXISTS "anon_select_evidence" ON evidence;
CREATE POLICY "anon_select_evidence" ON evidence FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_evidence" ON evidence;
CREATE POLICY "anon_insert_evidence" ON evidence FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_evidence" ON evidence;
CREATE POLICY "anon_update_evidence" ON evidence FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_evidence" ON evidence;
CREATE POLICY "anon_delete_evidence" ON evidence FOR DELETE TO anon, authenticated USING (true);

-- COVERAGE
CREATE TABLE IF NOT EXISTS coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  pages_discovered integer DEFAULT 0,
  pages_tested integer DEFAULT 0,
  features_discovered integer DEFAULT 0,
  features_tested integer DEFAULT 0,
  workflows_discovered integer DEFAULT 0,
  workflows_tested integer DEFAULT 0,
  test_cases_generated integer DEFAULT 0,
  test_cases_executed integer DEFAULT 0,
  passed integer DEFAULT 0,
  failed integer DEFAULT 0,
  blocked integer DEFAULT 0,
  coverage_percentage numeric(5,2) DEFAULT 0,
  untested_areas jsonb DEFAULT '[]'::jsonb,
  techniques_used jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coverage ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coverage_run ON coverage(run_id);
DROP POLICY IF EXISTS "anon_select_coverage" ON coverage;
CREATE POLICY "anon_select_coverage" ON coverage FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coverage" ON coverage;
CREATE POLICY "anon_insert_coverage" ON coverage FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coverage" ON coverage;
CREATE POLICY "anon_update_coverage" ON coverage FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coverage" ON coverage;
CREATE POLICY "anon_delete_coverage" ON coverage FOR DELETE TO anon, authenticated USING (true);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'full' CHECK (type IN ('full', 'executive', 'bug', 'coverage')),
  format text DEFAULT 'json' CHECK (format IN ('json', 'pdf', 'csv')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reports_run ON reports(run_id);
DROP POLICY IF EXISTS "anon_select_reports" ON reports;
CREATE POLICY "anon_select_reports" ON reports FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reports" ON reports;
CREATE POLICY "anon_insert_reports" ON reports FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reports" ON reports;
CREATE POLICY "anon_update_reports" ON reports FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reports" ON reports;
CREATE POLICY "anon_delete_reports" ON reports FOR DELETE TO anon, authenticated USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_projects_updated ON projects;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
