import { useEffect, useState, useCallback } from "react";
import { supabase, EDGE_FUNCTION_URL } from "@/lib/supabase";
import type { Project, Target, TestConfiguration, TestRun } from "@/types";
import { Sidebar, type PageKey } from "@/components/Sidebar";
import { Dashboard } from "@/pages/Dashboard";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { CreateProjectPage } from "@/pages/CreateProjectPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { TestRunsPage } from "@/pages/TestRunsPage";
import { TestRunDetailPage } from "@/pages/TestRunDetailPage";
import { TestCasesPage } from "@/pages/TestCasesPage";
import { TestCaseDetailPage } from "@/pages/TestCaseDetailPage";
import { BugsPage } from "@/pages/BugsPage";
import { BugDetailPage } from "@/pages/BugDetailPage";
import { CoveragePage } from "@/pages/CoveragePage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ReportDetailPage } from "@/pages/ReportDetailPage";
import { RunComparisonPage } from "@/pages/RunComparisonPage";
import { SettingsPage } from "@/pages/SettingsPage";

interface NavState {
  page: PageKey;
  projectId?: string;
  runId?: string;
  runIdA?: string;
  runIdB?: string;
  testCaseId?: string;
  bugId?: string;
  reportId?: string;
  showCreate?: boolean;
}

function App() {
  const [nav, setNav] = useState<NavState>({ page: "dashboard" });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    setProjects(data || []);
  }, []);

  useEffect(() => {
    fetchProjects().finally(() => setLoading(false));
  }, [fetchProjects]);

  const navigate = (page: PageKey, extra?: Partial<NavState>) => {
    setNav({ page, ...extra });
  };

  const startTesting = async (
    projectName: string,
    description: string,
    target: Omit<Target, "id" | "project_id" | "created_at">,
    config: Omit<TestConfiguration, "id" | "project_id" | "created_at" | "settings">,
    settings: Record<string, unknown>,
  ) => {
    // Create project
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({ name: projectName, description })
      .select()
      .single();

    if (projectError || !project) throw new Error("Failed to create project");

    // Create target
    const { data: targetRec, error: targetError } = await supabase
      .from("targets")
      .insert({ ...target, project_id: project.id })
      .select()
      .single();

    if (targetError || !targetRec) throw new Error("Failed to create target");

    // Create config
    const { data: configRec, error: configError } = await supabase
      .from("test_configurations")
      .insert({ ...config, project_id: project.id, settings })
      .select()
      .single();

    if (configError || !configRec) throw new Error("Failed to create config");

    // Create initial version v1.0
    const { data: versionRec } = await supabase
      .from("project_versions")
      .insert({
        project_id: project.id,
        version_label: "v1.0",
        description: "Initial baseline",
      })
      .select()
      .single();

    // Build config snapshot
    const configSnapshot = {
      profile: config.profile,
      max_pages: config.max_pages,
      max_test_cases: config.max_test_cases,
      crawl_depth: config.crawl_depth,
      rate_limit_ms: config.rate_limit_ms,
      timeout_ms: config.timeout_ms,
      screenshot_on_failure: config.screenshot_on_failure,
      capture_console: config.capture_console,
      capture_network: config.capture_network,
      target_url: target.url,
      target_type: target.type,
      environment: target.environment,
      auth_required: target.auth_required,
      auth_login_url: (target as Record<string, unknown>).auth_login_url ?? null,
    };

    // Create run
    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .insert({
        project_id: project.id,
        target_id: targetRec.id,
        config_id: configRec.id,
        version_id: versionRec?.id ?? null,
        config_snapshot: configSnapshot,
        status: "pending",
      })
      .select()
      .single();

    if (runError || !run) throw new Error("Failed to create test run");

    // Trigger edge function (fire and forget — UI polls for updates)
    fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id }),
    }).catch(() => {});

    await fetchProjects();
    navigate("runs", { runId: run.id });
  };

  const renderPage = () => {
    switch (nav.page) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} />;
      case "projects":
        if (nav.showCreate) {
          return <CreateProjectPage onNavigate={navigate} onStart={startTesting} />;
        }
        if (nav.projectId) {
          return <ProjectDetailPage projectId={nav.projectId} onNavigate={navigate} />;
        }
        return <ProjectsPage onNavigate={navigate} projects={projects} loading={loading} onRefresh={fetchProjects} />;
      case "runs":
        if (nav.runIdA && nav.runIdB) {
          return <RunComparisonPage runIdA={nav.runIdA} runIdB={nav.runIdB} onNavigate={navigate} />;
        }
        if (nav.runId) {
          return <TestRunDetailPage runId={nav.runId} onNavigate={navigate} />;
        }
        return <TestRunsPage onNavigate={navigate} />;
      case "test-cases":
        return nav.testCaseId ? (
          <TestCaseDetailPage testCaseId={nav.testCaseId} onNavigate={navigate} />
        ) : (
          <TestCasesPage onNavigate={navigate} />
        );
      case "bugs":
        return nav.bugId ? (
          <BugDetailPage bugId={nav.bugId} onNavigate={navigate} />
        ) : (
          <BugsPage onNavigate={navigate} />
        );
      case "coverage":
        return <CoveragePage onNavigate={navigate} />;
      case "reports":
        return nav.reportId ? (
          <ReportDetailPage reportId={nav.reportId} onNavigate={navigate} />
        ) : (
          <ReportsPage onNavigate={navigate} />
        );
      case "settings":
        return <SettingsPage />;
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentPage={nav.page} onNavigate={(p) => navigate(p)} />
      <main className="flex-1 lg:ml-0 pt-16 lg:pt-0 min-w-0">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
