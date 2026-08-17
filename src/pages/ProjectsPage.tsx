import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Project, Target, TestRun } from "@/types";
import { formatDate } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import {
  FolderKanban,
  Plus,
  Globe,
  Smartphone,
  ChevronRight,
  Trash2,
} from "lucide-react";

interface ProjectsPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
  projects: Project[];
  loading: boolean;
  onRefresh: () => void;
}

export function ProjectsPage({ onNavigate, projects, loading, onRefresh }: ProjectsPageProps) {
  const [projectTargets, setProjectTargets] = useState<Record<string, Target[]>>({});
  const [projectRuns, setProjectRuns] = useState<Record<string, TestRun[]>>({});

  useEffect(() => {
    const fetchDetails = async () => {
      const targetsMap: Record<string, Target[]> = {};
      const runsMap: Record<string, TestRun[]> = {};

      for (const project of projects) {
        const [targetsResp, runsResp] = await Promise.all([
          supabase.from("targets").select("*").eq("project_id", project.id),
          supabase
            .from("test_runs")
            .select("*, targets!inner(*), test_configurations!inner(*)")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false }),
        ]);
        targetsMap[project.id] = (targetsResp.data as Target[]) || [];
        runsMap[project.id] = (runsResp.data as TestRun[]) || [];
      }

      setProjectTargets(targetsMap);
      setProjectRuns(runsMap);
    };

    if (projects.length > 0) fetchDetails();
  }, [projects]);

  const handleDelete = async (projectId: string) => {
    if (!confirm("Delete this project and all its data? This cannot be undone.")) return;
    await supabase.from("projects").delete().eq("id", projectId);
    onRefresh();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500">Manage your test projects and targets</p>
          </div>
        </div>
        <button
          onClick={() => onNavigate("projects", { showCreate: true })}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects yet</h3>
          <p className="text-sm text-slate-500 mb-6">Create your first project to start AI testing</p>
          <button
            onClick={() => onNavigate("projects", { showCreate: true })}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {projects.map((project) => {
            const targets = projectTargets[project.id] || [];
            const runs = projectRuns[project.id] || [];
            const completedRuns = runs.filter((r) => r.status === "completed");

            return (
              <div
                key={project.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 truncate">{project.name}</h3>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{project.description || "No description"}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                    <span>{formatDate(project.created_at)}</span>
                    <span>·</span>
                    <span>{runs.length} runs</span>
                    <span>·</span>
                    <span>{completedRuns.length} completed</span>
                  </div>

                  {/* Targets */}
                  <div className="space-y-2">
                    {targets.map((target) => (
                      <div key={target.id} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                        {target.type === "website" ? (
                          <Globe className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        )}
                        <span className="text-slate-700 truncate flex-1">
                          {target.url || target.file_name || "Unknown target"}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">{target.environment}</span>
                      </div>
                    ))}
                  </div>

                  {runs.length > 0 && (
                    <button
                      onClick={() => onNavigate("runs", { runId: runs[0].id })}
                      className="mt-4 w-full flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      <span>View latest run</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
