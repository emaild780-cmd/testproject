import { useEffect, useState, useCallback } from "react";
import { supabase, EDGE_FUNCTION_URL } from "@/lib/supabase";
import type { Project, Target, TestConfiguration, TestRun, ProjectVersion } from "@/types";
import {
  STATUS_COLORS,
  getQualityScoreColor,
  formatDate,
  formatDuration,
  PROFILE_LABELS,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { ArrowLeft, Globe, CirclePlay as PlayCircle, Plus, GitBranch, ChevronRight, CircleCheck as CheckCircle2, Circle as XCircle, CirclePause as PauseCircle, Bug as BugIcon, Loader as Loader2, Rocket, Lock } from "lucide-react";

interface ProjectDetailPageProps {
  projectId: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function ProjectDetailPage({ projectId, onNavigate }: ProjectDetailPageProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [config, setConfig] = useState<TestConfiguration | null>(null);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingRun, setCreatingRun] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState("");
  const [newVersionDesc, setNewVersionDesc] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [projResp, targetResp, configResp, versionsResp, runsResp] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("targets").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("test_configurations").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("project_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("test_runs")
        .select("*, targets!inner(*), test_configurations!inner(*), project_versions(*)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false }),
    ]);

    setProject((projResp.data as Project) || null);
    setTarget((targetResp.data as Target) || null);
    setConfig((configResp.data as TestConfiguration) || null);
    setVersions((versionsResp.data as ProjectVersion[]) || []);
    setRuns((runsResp.data as TestRun[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleCreateVersion = async () => {
    if (!newVersionLabel.trim()) return;
    const { data, error } = await supabase
      .from("project_versions")
      .insert({
        project_id: projectId,
        version_label: newVersionLabel.trim(),
        description: newVersionDesc.trim() || null,
      })
      .select()
      .single();
    if (!error && data) {
      setVersions([data as ProjectVersion, ...versions]);
      setSelectedVersionId((data as ProjectVersion).id);
    }
    setShowVersionModal(false);
    setNewVersionLabel("");
    setNewVersionDesc("");
  };

  const handleNewRun = async () => {
    if (!target || !config) return;
    setCreatingRun(true);

    const configSnapshot = {
      profile: config.profile,
      max_pages: config.max_pages,
      max_test_cases: config.max_test_cases,
      crawl_depth: config.crawl_depth,
      rate_limit_ms: config.rate_limit_ms,
      timeout_ms: config.timeout_ms,
      screenshot_on_failure: config.screenshot_on_failure,
      capture_console: config.capture_console,
      capture_network: config.capture_network,
      target_url: target.url,
      target_type: target.type,
      environment: target.environment,
      auth_required: target.auth_required,
      auth_login_url: (target as Target & { auth_login_url?: string | null }).auth_login_url ?? null,
    };

    const { data: run, error } = await supabase
      .from("test_runs")
      .insert({
        project_id: projectId,
        target_id: target.id,
        config_id: config.id,
        version_id: selectedVersionId,
        config_snapshot: configSnapshot,
        status: "pending",
      })
      .select()
      .single();

    if (error || !run) {
      setCreatingRun(false);
      return;
    }

    fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: (run as TestRun).id }),
    }).catch(() => {});

    setCreatingRun(false);
    onNavigate("runs", { runId: (run as TestRun).id });
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!project) return <div className="p-8 text-center text-slate-400">Project not found</div>;

  const filteredRuns = selectedVersionId
    ? runs.filter((r) => r.version_id === selectedVersionId)
    : runs;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => onNavigate("projects")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-sm text-slate-500">{project.description || "No description"}</p>
          </div>
        </div>
        <button
          onClick={handleNewRun}
          disabled={creatingRun || !target}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creatingRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          New Test Run
        </button>
      </div>

      {/* Target & Config summary */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Target
          </h3>
          {target ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">URL:</span>
                <span className="text-slate-900 font-medium truncate">{target.url || target.file_name || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Type:</span>
                <span className="text-slate-900 capitalize">{target.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Environment:</span>
                <span className="text-slate-900 capitalize">{target.environment}</span>
              </div>
              {target.auth_required && (
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-amber-600 text-xs">Authentication enabled</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No target configured</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-cyan-600" />
            Configuration
          </h3>
          {config ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Profile:</span>
                <span className="text-slate-900">{PROFILE_LABELS[config.profile] || config.profile}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Max Pages:</span>
                <span className="text-slate-900">{config.max_pages}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Max Test Cases:</span>
                <span className="text-slate-900">{config.max_test_cases}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Crawl Depth:</span>
                <span className="text-slate-900">{config.crawl_depth}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No configuration found</p>
          )}
        </div>
      </div>

      {/* Versions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-600" />
            Versions
          </h3>
          <button
            onClick={() => setShowVersionModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Version
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedVersionId(null)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              selectedVersionId === null
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            All Versions
          </button>
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => setSelectedVersionId(v.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                selectedVersionId === v.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {v.version_label}
            </button>
          ))}
          {versions.length === 0 && (
            <span className="text-sm text-slate-400">No versions yet — runs will use the default baseline</span>
          )}
        </div>
      </div>

      {/* Run History */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h3 className="font-semibold text-slate-900 px-5 py-4 border-b border-slate-200">
          Run History ({filteredRuns.length})
        </h3>
        {filteredRuns.length === 0 ? (
          <div className="p-8 text-center">
            <PlayCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No runs yet. Click "New Test Run" to start testing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Run</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Version</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Passed</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Failed</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Blocked</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bugs</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRuns.map((run, i) => (
                  <tr
                    key={run.id}
                    onClick={() => onNavigate("runs", { runId: run.id })}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-sm font-mono text-slate-600">
                      #{String(i + 1).padStart(3, "0")}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {run.project_versions?.version_label || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[run.status]}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-emerald-600 font-medium">{run.passed}</td>
                    <td className="px-5 py-3 text-sm text-rose-600 font-medium">{run.failed}</td>
                    <td className="px-5 py-3 text-sm text-amber-600 font-medium">{run.blocked}</td>
                    <td className="px-5 py-3 text-sm text-orange-600 font-medium">{run.bugs_confirmed}</td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(run.created_at)}</td>
                    <td className="px-5 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Version Modal */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-md w-full">
            <h3 className="font-semibold text-slate-900 mb-4">Create New Version</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Version Label</label>
                <input
                  type="text"
                  value={newVersionLabel}
                  onChange={(e) => setNewVersionLabel(e.target.value)}
                  placeholder="e.g., v1.0"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newVersionDesc}
                  onChange={(e) => setNewVersionDesc(e.target.value)}
                  placeholder="What changed in this version?"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowVersionModal(false)}
                  className="px-4 py-2 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVersion}
                  disabled={!newVersionLabel.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Create Version
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
