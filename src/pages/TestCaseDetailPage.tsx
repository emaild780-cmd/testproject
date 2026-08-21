import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestCase, Execution, Evidence, Bug } from "@/types";
import {
  CASE_STATUS_COLORS,
  TECHNIQUE_LABELS,
  formatDate,
  formatDuration,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { ArrowLeft, CircleCheck as CheckCircle2, Circle as XCircle, Clock, FileText, Camera, Terminal, Wifi, Bug as BugIcon } from "lucide-react";

interface TestCaseDetailPageProps {
  testCaseId: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

const EVIDENCE_ICONS: Record<string, typeof Camera> = {
  screenshot: Camera,
  console_log: Terminal,
  network_log: Wifi,
  dom_snapshot: FileText,
  error_stack: FileText,
  video: Camera,
  har: FileText,
};

export function TestCaseDetailPage({ testCaseId, onNavigate }: TestCaseDetailPageProps) {
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [bug, setBug] = useState<Bug | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: tc } = await supabase
        .from("test_cases")
        .select("*")
        .eq("id", testCaseId)
        .maybeSingle();
      setTestCase(tc as TestCase | null);

      if (tc) {
        const [execResp, bugResp] = await Promise.all([
          supabase.from("executions").select("*").eq("test_case_id", testCaseId).order("attempt", { ascending: true }),
          tc.bug_id ? supabase.from("bugs").select("*").eq("id", tc.bug_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        const execs = (execResp.data as Execution[]) || [];
        setExecutions(execs);

        if (bugResp.data) setBug(bugResp.data as Bug);

        // Fetch evidence for all executions
        if (execs.length > 0) {
          const { data: evidenceData } = await supabase
            .from("evidence")
            .select("*")
            .in("execution_id", execs.map((e) => e.id));
          setEvidence((evidenceData as Evidence[]) || []);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [testCaseId]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!testCase) return <div className="p-8 text-center text-slate-400">Test case not found</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => onNavigate("runs")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-slate-500">{testCase.case_id}</span>
              <span className={`px-2 py-1 rounded-md text-xs font-medium border ${CASE_STATUS_COLORS[testCase.status]}`}>
                {testCase.status}
              </span>
              <span className="px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                {TECHNIQUE_LABELS[testCase.technique] || testCase.technique}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{testCase.scenario}</h1>
            <p className="text-sm text-slate-500 mt-1">Module: {testCase.module_page}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Preconditions</p>
            <p className="text-sm text-slate-700">{testCase.preconditions || "None"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Test Data</p>
            <p className="text-sm text-slate-700">
              {Object.keys(testCase.test_data).length > 0
                ? JSON.stringify(testCase.test_data)
                : "None"}
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Test Steps</h2>
        <div className="space-y-3">
          {testCase.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  <span className="text-blue-600">{step.action}</span> → {step.target}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Expected: {step.expected}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 mb-1">Expected Result</p>
          <p className="text-sm text-slate-700">{testCase.expected_result}</p>
          {testCase.actual_result && (
            <>
              <p className="text-xs font-medium text-slate-500 mt-3 mb-1">Actual Result</p>
              <p className="text-sm text-slate-700">{testCase.actual_result}</p>
            </>
          )}
        </div>
      </div>

      {/* Executions */}
      {executions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">Execution History</h2>
          <div className="space-y-3">
            {executions.map((exec) => (
              <div key={exec.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {exec.status === "passed" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : exec.status === "failed" ? (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      Attempt {exec.attempt}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CASE_STATUS_COLORS[exec.status as keyof typeof CASE_STATUS_COLORS] || "bg-slate-100 text-slate-600"}`}>
                      {exec.status}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">{formatDuration(exec.duration_ms)}</span>
                </div>
                {exec.error_message && (
                  <p className="text-xs text-rose-600 mt-2">{exec.error_message}</p>
                )}
                {Array.isArray(exec.logs) && exec.logs.length > 0 && (
                  <div className="mt-3 bg-slate-900 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {(exec.logs as Record<string, string>[]).slice(0, 10).map((log, i) => (
                      <div key={i} className="text-xs font-mono text-slate-300 mb-1">
                        <span className={log.level === "error" ? "text-rose-400" : log.level === "info" ? "text-blue-400" : "text-slate-400"}>
                          {`[${log.level || "info"}]`}
                        </span>{" "}
                        {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence */}
      {evidence.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">Evidence</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {evidence.map((ev) => {
              const Icon = EVIDENCE_ICONS[ev.type] || FileText;
              return (
                <div key={ev.id} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-slate-900">{ev.label || ev.type}</span>
                  </div>
                  {ev.content && (
                    <pre className="text-xs text-slate-600 bg-slate-50 rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">
                      {ev.content.slice(0, 500)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Related Bug */}
      {bug && (
        <div className="bg-white rounded-xl border border-rose-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BugIcon className="w-5 h-5 text-rose-600" />
            Related Bug
          </h2>
          <button
            onClick={() => onNavigate("bugs", { bugId: bug.id })}
            className="w-full text-left p-3 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-500">{bug.bug_id}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${
                bug.severity === "critical" ? "bg-rose-500" :
                bug.severity === "high" ? "bg-orange-500" :
                bug.severity === "medium" ? "bg-amber-500" : "bg-sky-500"
              }`}>
                {bug.severity}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900">{bug.title}</p>
          </button>
        </div>
      )}
    </div>
  );
}
