import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Report, TestRun } from "@/types";
import { formatDate, getQualityScoreColor } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { FileText, ChevronRight, Globe, Download } from "lucide-react";

interface ReportsPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function ReportsPage({ onNavigate }: ReportsPageProps) {
  const [reports, setReports] = useState<Report[]>([]);
  const [runs, setRuns] = useState<Record<string, TestRun>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .order("generated_at", { ascending: false });
      const reportData = (data as Report[]) || [];
      setReports(reportData);

      const runIds = [...new Set(reportData.map((r) => r.run_id))];
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
    fetchData();
  }, []);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">AI-generated QA reports with export</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No reports generated yet</p>
          <p className="text-xs text-slate-400 mt-1">Reports are automatically created when a test run completes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const run = runs[report.run_id];
            const execSummary = report.data?.executiveSummary as Record<string, unknown> | undefined;
            const qualityScore = execSummary?.qualityScore as number | undefined;

            return (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => onNavigate("reports", { reportId: report.id })}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 capitalize">
                        {report.type}
                      </span>
                      {qualityScore !== undefined && (
                        <span className={`text-sm font-bold ${getQualityScoreColor(qualityScore)}`}>
                          Score: {qualityScore}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-600" />
                      {run?.targets?.url || "Unknown target"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{formatDate(report.generated_at)}</p>
                  </button>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onNavigate("reports", { reportId: report.id })}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
