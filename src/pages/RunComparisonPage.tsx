import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRun, TestCase, Bug, Coverage } from "@/types";
import {
  STATUS_COLORS,
  formatDate,
  getQualityScoreColor,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { ArrowLeft, GitCompare, Globe, CircleCheck as CheckCircle2, Circle as XCircle, TrendingUp, TrendingDown, Minus, Bug as BugIcon } from "lucide-react";

interface RunComparisonPageProps {
  runIdA: string;
  runIdB: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

interface RunData {
  run: TestRun | null;
  cases: TestCase[];
  bugs: Bug[];
  coverage: Coverage | null;
}

export function RunComparisonPage({ runIdA, runIdB, onNavigate }: RunComparisonPageProps) {
  const [dataA, setDataA] = useState<RunData | null>(null);
  const [dataB, setDataB] = useState<RunData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRun = async (runId: string): Promise<RunData> => {
      const [runResp, casesResp, bugsResp, coverageResp] = await Promise.all([
        supabase.from("test_runs").select("*, targets!inner(*), test_configurations!inner(*), project_versions(*)").eq("id", runId).single(),
        supabase.from("test_cases").select("*").eq("run_id", runId),
        supabase.from("bugs").select("*").eq("run_id", runId),
        supabase.from("coverage").select("*").eq("run_id", runId).maybeSingle(),
      ]);
      return {
        run: (runResp.data as TestRun) || null,
        cases: (casesResp.data as TestCase[]) || [],
        bugs: (bugsResp.data as Bug[]) || [],
        coverage: (coverageResp.data as Coverage) || null,
      };
    };

    Promise.all([fetchRun(runIdA), fetchRun(runIdB)]).then(([a, b]) => {
      setDataA(a);
      setDataB(b);
      setLoading(false);
    });
  }, [runIdA, runIdB]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading comparison...</div>;
  if (!dataA?.run || !dataB?.run) return <div className="p-8 text-center text-slate-400">Could not load both runs</div>;

  const runA = dataA.run;
  const runB = dataB.run;

  const scenariosA = new Set(dataA.cases.map((c) => c.scenario));
  const scenariosB = new Set(dataB.cases.map((c) => c.scenario));
  const sharedScenarios = [...scenariosA].filter((s) => scenariosB.has(s));

  const failedA = new Set(dataA.cases.filter((c) => c.status === "failed").map((c) => c.scenario));
  const failedB = new Set(dataB.cases.filter((c) => c.status === "failed").map((c) => c.scenario));

  const newlyFailing = [...failedB].filter((s) => !failedA.has(s));
  const nowPassing = [...failedA].filter((s) => !failedB.has(s));
  const stillFailing = [...failedA].filter((s) => failedB.has(s));

  const bugTitlesA = new Set(dataA.bugs.map((b) => b.title));
  const bugTitlesB = new Set(dataB.bugs.map((b) => b.title));
  const newBugs = dataB.bugs.filter((b) => !bugTitlesA.has(b.title));
  const resolvedBugs = dataA.bugs.filter((b) => !bugTitlesB.has(b.title));

  const diff = (a: number, b: number) => {
    const d = b - a;
    if (d > 0) return { value: `+${d}`, color: "text-emerald-600", icon: TrendingUp };
    if (d < 0) return { value: `${d}`, color: "text-rose-600", icon: TrendingDown };
    return { value: "0", color: "text-slate-400", icon: Minus };
  };

  const metrics: { label: string; a: number; b: number }[] = [
    { label: "Test Cases", a: dataA.cases.length, b: dataB.cases.length },
    { label: "Passed", a: runA.passed, b: runB.passed },
    { label: "Failed", a: runA.failed, b: runB.failed },
    { label: "Blocked", a: runA.blocked, b: runB.blocked },
    { label: "Bugs", a: dataA.bugs.length, b: dataB.bugs.length },
    { label: "Coverage %", a: dataA.coverage?.coverage_percentage ?? 0, b: dataB.coverage?.coverage_percentage ?? 0 },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <button
        onClick={() => onNavigate("runs")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to test runs
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <GitCompare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Run Comparison</h1>
          <p className="text-sm text-slate-500">Comparing two test executions side by side</p>
        </div>
      </div>

      {/* Run headers */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {[runA, runB].map((run, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500">Run {i === 0 ? "A" : "B"}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[run.status]}`}>
                {run.status}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              {run.targets?.url || "Unknown"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {run.project_versions?.version_label || "No version"} · {formatDate(run.created_at)}
            </p>
            {run.quality_score !== null && (
              <p className={`text-sm font-bold mt-2 ${getQualityScoreColor(run.quality_score)}`}>
                Score: {run.quality_score}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Metrics comparison */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <h3 className="font-semibold text-slate-900 px-5 py-4 border-b border-slate-200">Metrics Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Metric</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Run A</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Run B</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {metrics.map((m) => {
                const d = diff(m.a, m.b);
                const DiffIcon = d.icon;
                return (
                  <tr key={m.label}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-900">{m.label}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{m.a}</td>
                    <td className="px-5 py-3 text-sm text-slate-600">{m.b}</td>
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1 text-sm font-medium ${d.color}`}>
                        <DiffIcon className="w-4 h-4" />
                        {d.value}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test case changes */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-5 h-5 text-rose-500" />
            <h4 className="font-medium text-slate-900 text-sm">Newly Failing</h4>
          </div>
          <p className="text-2xl font-bold text-rose-600 mb-2">{newlyFailing.length}</p>
          {newlyFailing.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {newlyFailing.slice(0, 10).map((s) => (
                <p key={s} className="text-xs text-slate-500 truncate">{s}</p>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h4 className="font-medium text-slate-900 text-sm">Now Passing</h4>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mb-2">{nowPassing.length}</p>
          {nowPassing.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {nowPassing.slice(0, 10).map((s) => (
                <p key={s} className="text-xs text-slate-500 truncate">{s}</p>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Minus className="w-5 h-5 text-amber-500" />
            <h4 className="font-medium text-slate-900 text-sm">Still Failing</h4>
          </div>
          <p className="text-2xl font-bold text-amber-600 mb-2">{stillFailing.length}</p>
          {stillFailing.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {stillFailing.slice(0, 10).map((s) => (
                <p key={s} className="text-xs text-slate-500 truncate">{s}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bug changes */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BugIcon className="w-5 h-5 text-rose-500" />
            <h4 className="font-medium text-slate-900 text-sm">New Bugs ({newBugs.length})</h4>
          </div>
          {newBugs.length > 0 ? (
            <div className="space-y-2">
              {newBugs.map((b) => (
                <div key={b.id} className="text-sm">
                  <p className="font-medium text-slate-900 truncate">{b.title}</p>
                  <p className="text-xs text-slate-500">{b.severity} · {b.module}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No new bugs</p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <h4 className="font-medium text-slate-900 text-sm">Resolved Bugs ({resolvedBugs.length})</h4>
          </div>
          {resolvedBugs.length > 0 ? (
            <div className="space-y-2">
              {resolvedBugs.map((b) => (
                <div key={b.id} className="text-sm">
                  <p className="font-medium text-slate-900 truncate">{b.title}</p>
                  <p className="text-xs text-slate-500">{b.severity} · {b.module}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No resolved bugs</p>
          )}
        </div>
      </div>

      {/* Shared scenarios count */}
      <div className="mt-6 bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-500">
        {sharedScenarios.length} shared test scenarios across both runs
      </div>
    </div>
  );
}
