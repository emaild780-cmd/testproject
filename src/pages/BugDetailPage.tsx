import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Bug, TestCase } from "@/types";
import {
  SEVERITY_COLORS,
  PRIORITY_COLORS,
  FAILURE_TYPE_COLORS,
  TECHNIQUE_LABELS,
  formatDate,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import {
  ArrowLeft,
  Bug as BugIcon,
  Globe,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface BugDetailPageProps {
  bugId: string;
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function BugDetailPage({ bugId, onNavigate }: BugDetailPageProps) {
  const [bug, setBug] = useState<Bug | null>(null);
  const [testCase, setTestCase] = useState<TestCase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: bugData } = await supabase
        .from("bugs")
        .select("*")
        .eq("id", bugId)
        .maybeSingle();
      setBug(bugData as Bug | null);

      if (bugData && (bugData as Bug).test_case_id) {
        const { data: tcData } = await supabase
          .from("test_cases")
          .select("*")
          .eq("id", (bugData as Bug).test_case_id!)
          .maybeSingle();
        setTestCase(tcData as TestCase | null);
      }
      setLoading(false);
    };
    fetchData();
  }, [bugId]);

  if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
  if (!bug) return <div className="p-8 text-center text-slate-400">Bug not found</div>;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => onNavigate("bugs")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to bugs
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-mono text-slate-500">{bug.bug_id}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[bug.severity]}`}>
                {bug.severity}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${PRIORITY_COLORS[bug.priority]}`}>
                {bug.priority.toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium border ${FAILURE_TYPE_COLORS[bug.failure_type]}`}>
                {bug.failure_type.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900">{bug.title}</h1>
            {bug.module && (
              <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                {bug.module}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            {bug.reproduction_status === "confirmed" || bug.reproduction_status === "reproduced" ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" />
                {bug.reproduction_status}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium border border-amber-200">
                <AlertTriangle className="w-4 h-4" />
                {bug.reproduction_status.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Environment</p>
            <p className="text-sm text-slate-700 capitalize">{bug.environment || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Reported</p>
            <p className="text-sm text-slate-700">{formatDate(bug.created_at)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Preconditions</p>
            <p className="text-sm text-slate-700">{bug.preconditions || "None"}</p>
          </div>
          {bug.url && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">URL / Screen</p>
              <p className="text-sm text-slate-700 truncate">{bug.url}</p>
            </div>
          )}
        </div>
      </div>

      {/* Steps to Reproduce */}
      {bug.steps_to_reproduce && bug.steps_to_reproduce.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-4">Steps to Reproduce</h2>
          <div className="space-y-3">
            {bug.steps_to_reproduce.map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    <span className="text-rose-600">{step.action}</span> → {step.target}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Expected: {step.expected}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected vs Actual */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Expected Result
          </h3>
          <p className="text-sm text-slate-700">{bug.expected_result || "—"}</p>
        </div>
        <div className="bg-white rounded-xl border border-rose-200 p-5">
          <h3 className="text-sm font-semibold text-rose-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Actual Result
          </h3>
          <p className="text-sm text-slate-700">{bug.actual_result || "—"}</p>
        </div>
      </div>

      {/* Root Cause */}
      {bug.root_cause && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Probable Root Cause
          </h3>
          <p className="text-sm text-slate-700">{bug.root_cause}</p>
        </div>
      )}

      {/* Evidence */}
      {bug.evidence && Array.isArray(bug.evidence) && bug.evidence.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Evidence</h3>
          <div className="bg-slate-900 rounded-lg p-3 max-h-60 overflow-y-auto">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(bug.evidence, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Related Test Case */}
      {testCase && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <BugIcon className="w-4 h-4 text-blue-600" />
            Related Test Case
          </h3>
          <button
            onClick={() => onNavigate("test-cases", { testCaseId: testCase.id })}
            className="w-full text-left p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-500">{testCase.case_id}</span>
              <span className="text-xs text-slate-600">{TECHNIQUE_LABELS[testCase.technique] || testCase.technique}</span>
            </div>
            <p className="text-sm font-medium text-slate-900">{testCase.scenario}</p>
          </button>
        </div>
      )}
    </div>
  );
}
