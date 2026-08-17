import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestCase, TestRun } from "@/types";
import { CASE_STATUS_COLORS, TECHNIQUE_LABELS, formatDate } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { ListChecks, ChevronRight, Globe, Filter } from "lucide-react";

interface TestCasesPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function TestCasesPage({ onNavigate }: TestCasesPageProps) {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [runs, setRuns] = useState<Record<string, TestRun>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [techniqueFilter, setTechniqueFilter] = useState<string>("all");

  useEffect(() => {
    const fetchCases = async () => {
      const { data } = await supabase
        .from("test_cases")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      const casesData = (data as TestCase[]) || [];
      setCases(casesData);

      const runIds = [...new Set(casesData.map((c) => c.run_id))];
      if (runIds.length > 0) {
        const { data: runsData } = await supabase
          .from("test_runs")
          .select("*, targets!inner(*)")
          .in("id", runIds);
        const map: Record<string, TestRun> = {};
        (runsData as TestRun[] || []).forEach((r) => { map[r.id] = r; });
        setRuns(map);
      }
      setLoading(false);
    };
    fetchCases();
  }, []);

  const filtered = cases.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (techniqueFilter !== "all" && c.technique !== techniqueFilter) return false;
    return true;
  });

  const techniques = [...new Set(cases.map((c) => c.technique))];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <ListChecks className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Test Cases</h1>
          <p className="text-sm text-slate-500">All AI-generated test cases across runs</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-blue-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
          </select>
        </div>
        <select
          value={techniqueFilter}
          onChange={(e) => setTechniqueFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-blue-500 outline-none"
        >
          <option value="all">All Techniques</option>
          {techniques.map((t) => (
            <option key={t} value={t}>{TECHNIQUE_LABELS[t as keyof typeof TECHNIQUE_LABELS] || t}</option>
          ))}
        </select>
        <span className="text-sm text-slate-500 ml-auto">{filtered.length} cases</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No test cases found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Scenario</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Module</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Technique</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Run</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tc) => {
                  const run = runs[tc.run_id];
                  return (
                    <tr
                      key={tc.id}
                      onClick={() => onNavigate("test-cases", { testCaseId: tc.id })}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-mono text-slate-600">{tc.case_id}</td>
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-900 truncate max-w-[250px]">{tc.scenario}</p>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 truncate max-w-[150px]">{tc.module_page}</td>
                      <td className="px-5 py-3 text-xs text-slate-600">{TECHNIQUE_LABELS[tc.technique] || tc.technique}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${CASE_STATUS_COLORS[tc.status]}`}>
                          {tc.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Globe className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{run?.targets?.url || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><ChevronRight className="w-4 h-4 text-slate-400" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
