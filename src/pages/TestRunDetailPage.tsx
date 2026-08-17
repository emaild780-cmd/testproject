import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRun, TestCase, Bug, AppPage, Coverage } from "@/types";
import {
  STATUS_COLORS,
  CASE_STATUS_COLORS,
  SEVERITY_COLORS,
  TECHNIQUE_LABELS,
  getQualityScoreColor,
  getQualityScoreBg,
  formatDate,
  formatDuration,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import {
  ArrowLeft,
  Globe,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Bug as BugIcon,
  Gauge,
  TrendingUp,
  Loader2,
  Map,
  ListChecks,
  Activity,
} from "lucide-react";

interface TestRunDetailPageProps {
  runId: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function TestRunDetailPage({ runId, onNavigate }: TestRunDetailPageProps) {
  const [run, setRun] = useState<TestRun | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [pages, setPages] = useState<AppPage[]>([]);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "cases" | "bugs" | "map">("overview");

  const fetchAll = useCallback(async () => {
    const [runResp, casesResp, bugsResp, pagesResp, coverageResp] = await Promise.all([
      supabase
        .from("test_runs")
        .select("*, targets!inner(*), test_configurations!inner(*)")
        .eq("id", runId)
        .single(),
      supabase.from("test_cases").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
      supabase.from("bugs").select("*").eq("run_id", runId).order("created_at", { ascending: false }),
      supabase.from("app_pages").select("*").eq("run_id", runId).order("discovered_at", { ascending: true }),
      supabase.from("coverage").select("*").eq("run_id", runId).maybeSingle(),
    ]);

    setRun((runResp.data as TestRun) || null);
    setTestCases((casesResp.data as TestCase[]) || []);
    setBugs((bugsResp.data as Bug[]) || []);
    setPages((pagesResp.data as AppPage[]) || []);
    setCoverage((coverageResp.data as Coverage) || null);
    setLoading(false);
  }, [runId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Poll for updates when run is in progress
  useEffect(() => {
    if (!run || run.status === "completed" || run.status === "failed" || run.status === "cancelled") return;
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, [run?.status, fetchAll]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading...</div>;
  }

  if (!run) {
    return <div className="p-8 text-center text-slate-400">Run not found</div>;
  }

  const isActive = !["completed", "failed", "cancelled"].includes(run.status);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => onNavigate("runs")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to test runs
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{run.targets?.url || "Test Run"}</h1>
            <p className="text-sm text-slate-500">
              {run.test_configurations?.name} · {formatDate(run.created_at)}
            </p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${STATUS_COLORS[run.status]}`}>
          {run.status}
        </span>
      </div>

      {/* Progress bar */}
      {isActive && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">{run.current_phase || "Processing..."}</span>
            <span className="text-sm text-slate-500">{run.progress}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${run.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getQualityScoreBg(run.quality_score)} flex items-center justify-center mb-3`}>
            <Gauge className="w-5 h-5 text-white" />
          </div>
          <p className={`text-2xl font-bold ${getQualityScoreColor(run.quality_score)}`}>
            {run.quality_score ?? "—"}
          </p>
          <p className="text-xs text-slate-500 mt-1">Quality Score</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{run.total_test_cases}</p>
          <p className="text-xs text-slate-500 mt-1">Test Cases</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{run.passed}</p>
          <p className="text-xs text-slate-500 mt-1">Passed</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center mb-3">
            <XCircle className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-rose-600">{run.failed}</p>
          <p className="text-xs text-slate-500 mt-1">Failed</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center mb-3">
            <PauseCircle className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{run.blocked}</p>
          <p className="text-xs text-slate-500 mt-1">Blocked</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-3">
            <BugIcon className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-orange-600">{run.bugs_confirmed}</p>
          <p className="text-xs text-slate-500 mt-1">Bugs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {[
          { key: "overview" as const, label: "Overview", icon: Activity },
          { key: "cases" as const, label: `Test Cases (${testCases.length})`, icon: ListChecks },
          { key: "bugs" as const, label: `Bugs (${bugs.length})`, icon: BugIcon },
          { key: "map" as const, label: `App Map (${pages.length})`, icon: Map },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Coverage */}
          {coverage && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-600" />
                Coverage
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-2xl font-bold text-slate-900">{coverage.coverage_percentage}%</p>
                  <p className="text-xs text-slate-500">Page Coverage</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{coverage.pages_tested}/{coverage.pages_discovered}</p>
                  <p className="text-xs text-slate-500">Pages Tested</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{coverage.features_tested}/{coverage.features_discovered}</p>
                  <p className="text-xs text-slate-500">Features Tested</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{coverage.untested_areas.length}</p>
                  <p className="text-xs text-slate-500">Untested Areas</p>
                </div>
              </div>
              {coverage.techniques_used.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-2">Techniques Used</p>
                  <div className="flex flex-wrap gap-2">
                    {coverage.techniques_used.map((tech) => (
                      <span key={tech} className="px-2.5 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                        {TECHNIQUE_LABELS[tech as keyof typeof TECHNIQUE_LABELS] || tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {run.error_message && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-sm font-medium text-rose-700 mb-1">Run Error</p>
              <p className="text-sm text-rose-600">{run.error_message}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "cases" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isActive && testCases.length === 0 ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Generating test cases...</p>
            </div>
          ) : testCases.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No test cases generated</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Scenario</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Technique</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testCases.map((tc) => (
                    <tr
                      key={tc.id}
                      onClick={() => onNavigate("test-cases", { testCaseId: tc.id })}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-mono text-slate-600">{tc.case_id}</td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[300px]">{tc.scenario}</p>
                        <p className="text-xs text-slate-500">{tc.module_page}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-slate-600">{TECHNIQUE_LABELS[tc.technique] || tc.technique}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${CASE_STATUS_COLORS[tc.status]}`}>
                          {tc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "bugs" && (
        <div className="space-y-3">
          {bugs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <BugIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-sm text-slate-500">No bugs detected</p>
            </div>
          ) : (
            bugs.map((bug) => (
              <button
                key={bug.id}
                onClick={() => onNavigate("bugs", { bugId: bug.id })}
                className="w-full bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-500">{bug.bug_id}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[bug.severity]}`}>
                        {bug.severity}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{bug.title}</p>
                    <p className="text-xs text-slate-500 mt-1">{bug.module}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {activeTab === "map" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {pages.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No pages discovered yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pages.map((page) => (
                <div key={page.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{page.title || page.url}</p>
                      <p className="text-xs text-slate-500 truncate">{page.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {page.status_code !== null && page.status_code > 0 && (
                      <span className={`text-xs font-medium ${
                        page.status_code >= 400 ? "text-rose-600" : "text-emerald-600"
                      }`}>
                        {page.status_code}
                      </span>
                    )}
                    {page.load_time_ms !== null && (
                      <span className="text-xs text-slate-400">{formatDuration(page.load_time_ms)}</span>
                    )}
                    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${
                      page.status === "tested" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                      page.status === "failed" ? "bg-rose-100 text-rose-700 border-rose-200" :
                      "bg-slate-100 text-slate-600 border-slate-200"
                    }`}>
                      {page.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
