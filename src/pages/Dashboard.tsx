import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TestRun, Project, Bug as BugType } from "@/types";
import {
  STATUS_COLORS,
  getQualityScoreColor,
  getQualityScoreBg,
  formatDate,
} from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { ShieldCheck, TrendingUp, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Bug, Activity, Gauge, ArrowRight, CirclePlay as PlayCircle, FolderKanban } from "lucide-react";

interface DashboardProps {
  onNavigate: (page: PageKey, extra?: Record<string, string>) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentBugs, setRecentBugs] = useState<BugType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [runsResp, projectsResp, bugsResp] = await Promise.all([
        supabase
          .from("test_runs")
          .select("*, targets!inner(*), test_configurations!inner(*)")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase
          .from("bugs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      setRuns((runsResp.data as TestRun[]) || []);
      setProjects((projectsResp.data as Project[]) || []);
      setRecentBugs((bugsResp.data as BugType[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const completedRuns = runs.filter((r) => r.status === "completed");
  const totalTestCases = runs.reduce((sum, r) => sum + r.total_test_cases, 0);
  const totalPassed = runs.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = runs.reduce((sum, r) => sum + r.failed, 0);
  const totalBugs = runs.reduce((sum, r) => sum + r.bugs_confirmed, 0);
  const avgQuality = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((sum, r) => sum + (r.quality_score || 0), 0) / completedRuns.length)
    : 0;
  const avgCoverage = completedRuns.length > 0
    ? Math.round(completedRuns.reduce((sum, r) => sum + r.coverage_percentage, 0) / completedRuns.length)
    : 0;

  const stats = [
    {
      label: "Quality Score",
      value: avgQuality,
      suffix: "/100",
      icon: Gauge,
      color: getQualityScoreColor(avgQuality),
      bg: getQualityScoreBg(avgQuality),
    },
    { label: "Test Cases", value: totalTestCases, icon: Activity, color: "text-blue-600", bg: "from-blue-500 to-cyan-500" },
    { label: "Passed", value: totalPassed, icon: CheckCircle2, color: "text-emerald-600", bg: "from-emerald-500 to-teal-500" },
    { label: "Failed", value: totalFailed, icon: XCircle, color: "text-rose-600", bg: "from-rose-500 to-red-500" },
    { label: "Bugs Found", value: totalBugs, icon: Bug, color: "text-orange-600", bg: "from-orange-500 to-amber-500" },
    { label: "Coverage", value: avgCoverage, suffix: "%", icon: TrendingUp, color: "text-cyan-600", bg: "from-cyan-500 to-blue-500" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">AI-powered autonomous QA testing overview</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {stat.value}
                {stat.suffix && <span className="text-sm text-slate-400 font-normal">{stat.suffix}</span>}
              </p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent runs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <PlayCircle className="w-5 h-5 text-blue-600" />
              Recent Test Runs
            </h2>
            <button
              onClick={() => onNavigate("runs")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
            ) : runs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm mb-4">No test runs yet</p>
                <button
                  onClick={() => onNavigate("projects", { showCreate: "true" } as never)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create your first project
                </button>
              </div>
            ) : (
              runs.slice(0, 5).map((run) => (
                <button
                  key={run.id}
                  onClick={() => onNavigate("runs", { runId: run.id } as never)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {run.targets?.url || "Unknown target"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDate(run.created_at)} · {run.total_test_cases} tests
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {run.quality_score !== null && (
                      <span className={`text-sm font-bold ${getQualityScoreColor(run.quality_score)}`}>
                        {run.quality_score}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded-md text-xs font-medium border ${STATUS_COLORS[run.status]}`}>
                      {run.status}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent bugs */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Recent Bugs
            </h2>
            <button
              onClick={() => onNavigate("bugs")}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentBugs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No bugs detected yet</div>
            ) : (
              recentBugs.map((bug) => (
                <button
                  key={bug.id}
                  onClick={() => onNavigate("bugs", { bugId: bug.id } as never)}
                  className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {bug.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {bug.bug_id} · {bug.module}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ml-3 ${
                    bug.severity === "critical" ? "bg-rose-500 text-white" :
                    bug.severity === "high" ? "bg-orange-500 text-white" :
                    bug.severity === "medium" ? "bg-amber-500 text-white" :
                    "bg-sky-500 text-white"
                  }`}>
                    {bug.severity}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Projects summary */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-blue-600" />
            Projects
          </h2>
          <button
            onClick={() => onNavigate("projects")}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {projects.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No projects yet</div>
          ) : (
            projects.slice(0, 5).map((project) => (
              <div key={project.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{project.name}</p>
                  <p className="text-xs text-slate-500">{project.description || "No description"}</p>
                </div>
                <span className="text-xs text-slate-400">{formatDate(project.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
