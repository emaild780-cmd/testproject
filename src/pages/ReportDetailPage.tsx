import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Report, TestRun } from "@/types";
import { formatDate, getQualityScoreColor } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import {
  ArrowLeft,
  FileText,
  Globe,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Lightbulb,
} from "lucide-react";

interface ReportDetailPageProps {
  reportId: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function ReportDetailPage({ reportId, onNavigate }: ReportDetailPageProps) {
  const [report, setReport] = useState<Report | null>(null);
  const [run, setRun] = useState<TestRun | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: reportData } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .maybeSingle();
      const report = reportData as Report | null;
      setReport(report);

      if (report) {
        const { data: runData } = await supabase
          .from("test_runs")
          .select("*, targets!inner(*)")
          .eq("id", report.run_id)
          .maybeSingle();
        setRun(runData as TestRun | null);
      }
      setLoading(false);
    };
    fetchData();
  }, [reportId]);

  const exportCSV = () => {
    if (!report) return;
    const data = report.data;
    const rows: string[] = [];

    // Executive summary
    const summary = data.executiveSummary as Record<string, unknown> | undefined;
    if (summary) {
      rows.push("Section,Key,Value");
      Object.entries(summary).forEach(([key, value]) => {
        rows.push(`Executive Summary,${key},${value}`);
      });
    }

    // Test cases
    const testCases = data.testCases as Record<string, unknown>[] | undefined;
    if (testCases && testCases.length > 0) {
      rows.push("");
      rows.push("Case ID,Module,Scenario,Technique,Status");
      testCases.forEach((tc) => {
        rows.push(`${tc.caseId},${tc.module},${(tc.scenario as string || "").replace(/,/g, ";")},${tc.technique},${tc.status}`);
      });
    }

    // Bugs
    const bugs = data.confirmedBugs as Record<string, unknown>[] | undefined;
    if (bugs && bugs.length > 0) {
      rows.push("");
      rows.push("Bug ID,Title,Module,Severity,Failure Type");
      bugs.forEach((bug) => {
        rows.push(`${bug.bug_id},${(bug.title as string || "").replace(/,/g, ";")},${bug.module || ""},${bug.severity},${bug.failure_type}`);
      });
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-report-${reportId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-report-${reportId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!report) return <div className="p-8 text-center text-slate-400">Report not found</div>;

  const summary = report.data.executiveSummary as Record<string, unknown> | undefined;
  const appInfo = report.data.applicationInfo as Record<string, unknown> | undefined;
  const appMap = report.data.applicationMap as Record<string, unknown>[] | undefined;
  const testCases = report.data.testCases as Record<string, unknown>[] | undefined;
  const execResults = report.data.executionResults as Record<string, unknown> | undefined;
  const confirmedBugs = report.data.confirmedBugs as Record<string, unknown>[] | undefined;
  const coverage = report.data.coverage as Record<string, unknown> | undefined;
  const riskAnalysis = report.data.riskAnalysis as Record<string, unknown> | undefined;
  const recommendations = report.data.recommendations as string[] | undefined;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => onNavigate("reports")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to reports
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">QA Report</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              {run?.targets?.url || "Unknown"} · {formatDate(report.generated_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={exportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            JSON
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      {summary && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Executive Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.qualityScore !== undefined && (
              <div>
                <p className={`text-3xl font-bold ${getQualityScoreColor(summary.qualityScore as number)}`}>
                  {summary.qualityScore as number}
                </p>
                <p className="text-xs text-slate-500 mt-1">Quality Score</p>
              </div>
            )}
            {summary.totalTestCases !== undefined && (
              <div>
                <p className="text-3xl font-bold text-slate-900">{summary.totalTestCases as number}</p>
                <p className="text-xs text-slate-500 mt-1">Test Cases</p>
              </div>
            )}
            {summary.coveragePercentage !== undefined && (
              <div>
                <p className="text-3xl font-bold text-cyan-600">{summary.coveragePercentage as number}%</p>
                <p className="text-xs text-slate-500 mt-1">Coverage</p>
              </div>
            )}
            {summary.bugsConfirmed !== undefined && (
              <div>
                <p className="text-3xl font-bold text-orange-600">{summary.bugsConfirmed as number}</p>
                <p className="text-xs text-slate-500 mt-1">Bugs Confirmed</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="text-sm text-slate-700">{summary.passed as number} Passed</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span className="text-sm text-slate-700">{summary.failed as number} Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm text-slate-700">{summary.blocked as number} Blocked</span>
            </div>
          </div>
        </div>
      )}

      {/* Application Info */}
      {appInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Application Information</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">URL</p>
              <p className="text-slate-700 truncate">{appInfo.url as string}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Type</p>
              <p className="text-slate-700 capitalize">{appInfo.type as string}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Environment</p>
              <p className="text-slate-700 capitalize">{appInfo.environment as string}</p>
            </div>
          </div>
        </div>
      )}

      {/* Application Map */}
      {appMap && appMap.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Application Map</h3>
          <div className="divide-y divide-slate-100">
            {appMap.map((page, i) => (
              <div key={i} className="py-2 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-slate-700 truncate">{page.title as string || page.url as string}</span>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-xs text-slate-400">{page.features as number} features</span>
                  <span className={`text-xs font-medium ${(page.statusCode as number) >= 400 ? "text-rose-600" : "text-emerald-600"}`}>
                    {page.statusCode as number}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Results */}
      {execResults && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Execution Results</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">{execResults.total as number}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{execResults.passed as number}</p>
              <p className="text-xs text-slate-500">Passed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600">{execResults.failed as number}</p>
              <p className="text-xs text-slate-500">Failed</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-600">{execResults.passRate as number}%</p>
              <p className="text-xs text-slate-500">Pass Rate</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed Bugs */}
      {confirmedBugs && confirmedBugs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Confirmed Bugs</h3>
          <div className="space-y-2">
            {confirmedBugs.map((bug, i) => (
              <button
                key={i}
                onClick={() => bug.id && onNavigate("bugs", { bugId: bug.id as string })}
                className="w-full text-left p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500">{bug.bug_id as string}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                    bug.severity === "critical" ? "bg-rose-500" :
                    bug.severity === "high" ? "bg-orange-500" :
                    bug.severity === "medium" ? "bg-amber-500" : "bg-sky-500"
                  }`}>
                    {bug.severity as string}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">{bug.title as string}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coverage */}
      {coverage && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            Coverage
          </h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-lg font-bold text-slate-900">{coverage.coveragePercentage as number}%</p>
              <p className="text-xs text-slate-500">Page Coverage</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{coverage.pagesTested as number}/{coverage.pagesDiscovered as number}</p>
              <p className="text-xs text-slate-500">Pages</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{coverage.featuresTested as number}/{coverage.featuresDiscovered as number}</p>
              <p className="text-xs text-slate-500">Features</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{(coverage.untestedAreas as unknown[]).length}</p>
              <p className="text-xs text-slate-500">Untested</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Analysis */}
      {riskAnalysis && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="font-semibold text-slate-900 mb-3">Risk Analysis</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-rose-600">{riskAnalysis.criticalBugs as number}</p>
              <p className="text-xs text-slate-500">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{riskAnalysis.highBugs as number}</p>
              <p className="text-xs text-slate-500">High</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{riskAnalysis.mediumBugs as number}</p>
              <p className="text-xs text-slate-500">Medium</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sky-600">{riskAnalysis.lowBugs as number}</p>
              <p className="text-xs text-slate-500">Low</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            Recommendations
          </h3>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="text-amber-500 font-bold flex-shrink-0">{i + 1}.</span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
