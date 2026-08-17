import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Bug } from "@/types";
import { SEVERITY_COLORS, FAILURE_TYPE_COLORS, formatDate } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { Bug as BugIcon, ChevronRight, Filter } from "lucide-react";

interface BugsPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
}

export function BugsPage({ onNavigate }: BugsPageProps) {
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  useEffect(() => {
    const fetchBugs = async () => {
      const { data } = await supabase
        .from("bugs")
        .select("*")
        .order("created_at", { ascending: false });
      setBugs((data as Bug[]) || []);
      setLoading(false);
    };
    fetchBugs();
  }, []);

  const filtered = bugs.filter((b) => severityFilter === "all" || b.severity === severityFilter);

  const severityCounts = {
    critical: bugs.filter((b) => b.severity === "critical").length,
    high: bugs.filter((b) => b.severity === "high").length,
    medium: bugs.filter((b) => b.severity === "medium").length,
    low: bugs.filter((b) => b.severity === "low").length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
          <BugIcon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bugs</h1>
          <p className="text-sm text-slate-500">Confirmed and suspected defects</p>
        </div>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {(["critical", "high", "medium", "low"] as const).map((sev) => (
          <div key={sev} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium text-white ${SEVERITY_COLORS[sev]} mb-2 capitalize`}>
              {sev}
            </div>
            <p className="text-2xl font-bold text-slate-900">{severityCounts[sev]}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:border-blue-500 outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <span className="text-sm text-slate-500 ml-auto">{filtered.length} bugs</span>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BugIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-500">No bugs detected yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((bug) => (
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
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${FAILURE_TYPE_COLORS[bug.failure_type]}`}>
                      {bug.failure_type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{bug.title}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {bug.module} · {formatDate(bug.created_at)}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
