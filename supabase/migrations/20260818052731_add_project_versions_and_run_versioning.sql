-- Project versions table
CREATE TABLE IF NOT EXISTS project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON project_versions(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_versions_project_label ON project_versions(project_id, version_label);

-- Add version_id and config_snapshot to test_runs
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES project_versions(id) ON DELETE SET NULL;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS config_snapshot jsonb;

CREATE INDEX IF NOT EXISTS idx_test_runs_version_id ON test_runs(version_id);

-- Enable RLS on project_versions
ALTER TABLE project_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_project_versions" ON project_versions FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_project_versions" ON project_versions FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_project_versions" ON project_versions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_project_versions" ON project_versions FOR DELETE
  TO anon, authenticated USING (true);

-- Add version_id to reports for version-level report browsing
ALTER TABLE reports ADD COLUMN IF NOT EXISTS version_id uuid REFERENCES project_versions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reports_version_id ON reports(version_id) WHERE version_id IS NOT NULL;
