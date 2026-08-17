import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Coverage, TestRun } from "@/types";
import { TECHNIQUE_LABELS, formatDate } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import {
  GitBranch,
  Globe,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Map,
  ListChecks,
  ChevronRight,
} from "lucide-react";

interface CoveragePageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function CoveragePage({ onNavigate }: CoveragePageProps) {
  const [coverages, setCoverages] = useState<Coverage[]>([]);
  const [runs, setRuns] = useState<Record<string, TestRun>>({});
  const [loading, setLoading] = useState(true);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("coverage")
        .select("*")
        .order("created_at", { ascending: false });
      const coverageData = (data as Coverage[]) || [];
      setCoverages(coverageData);

      const runIds = [...new Set(coverageData.map((c) => c.run_id))];
      if (runIds.length > 0) {
        const { data: runsData } = await supabase
          .from("test_runs")
          .select("*, targets!inner(*)")
          .in("id", runIds);
        const map: Record<string, TestRun> = {};
        (runsData as TestRun[] || []).forEach((r) => { map[r.id] = r; });
        setRuns(map);
        if (coverageData.length > 0) setSelectedRunId(coverageData[0].run_id);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const selectedCoverage = coverages.find((c) => c.run_id === selectedRunId);
  const selectedRun = selectedRunId ? runs[selectedRunId] : null;

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <GitBranch className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coverage</h1>
          <p className="text-sm text-slate-500">Test coverage analysis and untested areas</p>
        </div>
      </div>

      {coverages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No coverage data yet. Run a test to see coverage analysis.</p>
        </div>
      ) : (
        <>
          {/* Run selector */}
          {coverages.length > 1 && (
            <div className="mb-6">
              <select
                value={selectedRunId || ""}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-blue-500 outline-none"
              >
                {coverages.map((c) => (
                  <option key={c.run_id} value={c.run_id}>
                    {runs[c.run_id]?.targets?.url || "Unknown"} — {formatDate(c.created_at)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedCoverage && (
            <>
              {/* Coverage stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mb-3">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{selectedCoverage.coverage_percentage}%</p>
                  <p className="text-xs text-slate-500 mt-1">Page Coverage</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
                    <Map className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{selectedCoverage.pages_tested}/{selectedCoverage.pages_discovered}</p>
                  <p className="text-xs text-slate-500 mt-1">Pages Tested</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-3">
                    <ListChecks className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{selectedCoverage.features_tested}/{selectedCoverage.features_discovered}</p>
                  <p className="text-xs text-slate-500 mt-1">Features Tested</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-3">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{selectedCoverage.untested_areas.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Untested Areas</p>
                </div>
              </div>

              {/* Pass/Fail breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
                <h3 className="font-semibold text-slate-900 mb-4">Test Execution Breakdown</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    <div>
                      <p className="text-xl font-bold text-emerald-600">{selectedCoverage.passed}</p>
                      <p className="text-xs text-slate-500">Passed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-rose-600" />
                    <div>
                      <p className="text-xl font-bold text-rose-600">{selectedCoverage.failed}</p>
                      <p className="text-xs text-slate-500">Failed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-amber-600" />
                    <div>
                      <p className="text-xl font-bold text-amber-600">{selectedCoverage.blocked}</p>
                      <p className="text-xs text-slate-500">Blocked</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Techniques used */}
              {selectedCoverage.techniques_used.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
                  <h3 className="font-semibold text-slate-900 mb-3">Testing Techniques Used</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedCoverage.techniques_used.map((tech) => (
                      <span key={tech} className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-600">
                        {TECHNIQUE_LABELS[tech as keyof typeof TECHNIQUE_LABELS] || tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Untested areas */}
              {selectedCoverage.untested_areas.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      Untested Areas
                    </h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {selectedCoverage.untested_areas.map((area, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-3">
                        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 truncate">{area.title || area.url}</p>
                          <p className="text-xs text-slate-500 truncate">{area.url}</p>
                        </div>
                        <span className="text-xs text-slate-400 ml-3">{area.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Link to run */}
              {selectedRun && (
                <button
                  onClick={() => onNavigate("runs", { runId: selectedRun.id })}
                  className="mt-6 flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  View full run details
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
