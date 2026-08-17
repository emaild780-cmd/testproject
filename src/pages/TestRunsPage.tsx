import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRun } from "@/types";
import { STATUS_COLORS, getQualityScoreColor, formatDate } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { PlayCircle, Globe, ChevronRight, Plus } from "lucide-react";

interface TestRunsPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function TestRunsPage({ onNavigate }: TestRunsPageProps) {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRuns = async () => {
      const { data } = await supabase
        .from("test_runs")
        .select("*, targets!inner(*), test_configurations!inner(*)")
        .order("created_at", { ascending: false });
      setRuns((data as TestRun[]) || []);
      setLoading(false);
    };
    fetchRuns();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <PlayCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Test Runs</h1>
            <p className="text-sm text-slate-500">View and monitor all test executions</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate("projects", { showCreate: true })}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Test Run
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : runs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <PlayCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No test runs yet</h3>
          <p className="text-sm text-slate-500 mb-6">Create a project and start AI testing</p>
          <button
            onClick={() => onNavigate("projects", { showCreate: true })}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Profile</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tests</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Quality</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => onNavigate("runs", { runId: run.id })}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                          {run.targets?.url || "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-slate-600 capitalize">{run.test_configurations?.profile?.replace("_", " ")}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[run.status]}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {run.status === "completed" ? (
                        <span className="text-sm text-slate-600">100%</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${run.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{run.progress}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-emerald-600 font-medium">{run.passed}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-rose-600 font-medium">{run.failed}</span>
                        <span className="text-slate-300">/</span>
                        <span className="text-amber-600 font-medium">{run.blocked}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {run.quality_score !== null ? (
                        <span className={`text-sm font-bold ${getQualityScoreColor(run.quality_score)}`}>
                          {run.quality_score}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500">{formatDate(run.created_at)}</td>
                    <td className="px-5 py-3">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
