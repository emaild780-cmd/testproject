import { useState } from "react";
import type { Target, TestConfiguration, TestProfile, Environment, TargetType } from "@/types";
import { PROFILE_LABELS, PROFILE_DESCRIPTIONS } from "@/lib/constants";
import type { PageKey } from "@/components/Sidebar";
import { Globe, Smartphone, ShieldCheck, Lock, Rocket, ArrowLeft, Loader as Loader2, CircleCheck as CheckCircle2 } from "lucide-react";

interface CreateProjectPageProps {
  onNavigate: (page: PageKey, extra?: Record<string, unknown>) => void;
  onStart: (
    projectName: string,
    description: string,
    target: Omit<Target, "id" | "project_id" | "created_at">,
    config: Omit<TestConfiguration, "id" | "project_id" | "created_at" | "settings">,
    settings: Record<string, unknown>,
  ) => Promise<void>;
}

const PROFILES: TestProfile[] = [
  "full_qa", "functional", "smoke", "regression", "exploratory",
  "ui", "accessibility", "performance", "security", "api",
];

const ENVIRONMENTS: Environment[] = ["development", "staging", "production"];

export function CreateProjectPage({ onNavigate, onStart }: CreateProjectPageProps) {
  const [step, setStep] = useState(1);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Target
  const [targetType, setTargetType] = useState<TargetType>("website");
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | null>(null);
  const [environment, setEnvironment] = useState<Environment>("staging");
  const [authRequired, setAuthRequired] = useState(false);
  const [authLoginUrl, setAuthLoginUrl] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);

  // Config
  const [profile, setProfile] = useState<TestProfile>("full_qa");
  const [maxPages, setMaxPages] = useState(20);
  const [maxTestCases, setMaxTestCases] = useState(50);
  const [crawlDepth, setCrawlDepth] = useState(2);
  const [rateLimitMs, setRateLimitMs] = useState(500);
  const [timeoutMs, setTimeoutMs] = useState(30000);

  // Authorization
  const [authorized, setAuthorized] = useState(false);

  const validateUrl = (value: string): boolean => {
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        setUrlError("URL must use http or https protocol");
        return false;
      }
      setUrlError(null);
      return true;
    } catch {
      setUrlError("Please enter a valid URL (e.g., https://example.com)");
      return false;
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validTypes = [".apk", ".aab", "application/vnd.android.package-archive"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validTypes.includes(ext)) {
      setError("Please upload a valid APK or AAB file");
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setError(null);
  };

  const handleStart = async () => {
    setError(null);

    if (!name.trim()) {
      setError("Project name is required");
      setStep(1);
      return;
    }
    if (targetType === "website" && !validateUrl(url)) {
      setError("Please enter a valid URL");
      setStep(2);
      return;
    }
    if (!authorized) {
      setError("You must confirm authorization to test this application");
      setStep(2);
      return;
    }

    setStarting(true);
    try {
      await onStart(
        name.trim(),
        description.trim(),
        {
          type: targetType,
          url: targetType === "website" ? url : null,
          platform: "android",
          file_name: fileName,
          file_size: fileSize,
          environment,
          auth_required: authRequired,
          auth_login_url: authRequired && authLoginUrl ? authLoginUrl : null,
          auth_username: authRequired ? authUsername : null,
          auth_password: authRequired ? authPassword : null,
          notes: null,
        },
        {
          name: PROFILE_LABELS[profile],
          profile,
          max_pages: maxPages,
          max_test_cases: maxTestCases,
          crawl_depth: crawlDepth,
          rate_limit_ms: rateLimitMs,
          timeout_ms: timeoutMs,
          screenshot_on_failure: true,
          capture_console: true,
          capture_network: true,
        },
        {},
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start testing");
      setStarting(false);
    }
  };

  const canProceedStep1 = name.trim().length > 0;
  const canProceedStep2 = targetType === "website" ? !!url && !urlError : !!fileName;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <button
        onClick={() => onNavigate("projects")}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to projects
      </button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Create Test Project</h1>
            <p className="text-sm text-slate-500">Set up a new AI-powered testing project</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { num: 1, label: "Project" },
          { num: 2, label: "Target" },
          { num: 3, label: "Configure" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step >= s.num
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-sm font-medium ${step >= s.num ? "text-slate-900" : "text-slate-400"}`}>
              {s.label}
            </span>
            {i < 2 && <div className={`flex-1 h-0.5 ${step > s.num ? "bg-blue-600" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Step 1: Project info */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., E-commerce Website QA"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this project tests..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Set Target
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Target setup */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Target Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTargetType("website")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    targetType === "website"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Globe className={`w-6 h-6 mb-2 ${targetType === "website" ? "text-blue-600" : "text-slate-400"}`} />
                  <p className="font-medium text-slate-900 text-sm">Website</p>
                  <p className="text-xs text-slate-500 mt-1">Test a web URL with Playwright</p>
                </button>
                <button
                  onClick={() => setTargetType("mobile")}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    targetType === "mobile"
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Smartphone className={`w-6 h-6 mb-2 ${targetType === "mobile" ? "text-blue-600" : "text-slate-400"}`} />
                  <p className="font-medium text-slate-900 text-sm">Mobile App</p>
                  <p className="text-xs text-slate-500 mt-1">Upload APK/AAB (Android)</p>
                </button>
              </div>
            </div>

            {targetType === "website" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Target URL</label>
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (e.target.value) validateUrl(e.target.value);
                    }}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                  />
                  {urlError && <p className="text-xs text-rose-600 mt-1">{urlError}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Environment</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ENVIRONMENTS.map((env) => (
                      <button
                        key={env}
                        onClick={() => setEnvironment(env)}
                        className={`px-4 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                          environment === env
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                    <Lock className="w-4 h-4" />
                    Authentication (optional)
                  </label>
                  <button
                    onClick={() => setAuthRequired(!authRequired)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${authRequired ? "bg-blue-600" : "bg-slate-200"}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        authRequired ? "translate-x-6" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  {authRequired && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">Login URL (optional — defaults to /login on the target domain)</label>
                        <input
                          type="url"
                          value={authLoginUrl}
                          onChange={(e) => setAuthLoginUrl(e.target.value)}
                          placeholder="https://example.com/login"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={authUsername}
                          onChange={(e) => setAuthUsername(e.target.value)}
                          placeholder="Username / Email"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        />
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="Password"
                          className="px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Upload APK/AAB</label>
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    accept=".apk,.aab"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <Smartphone className="w-8 h-8 text-slate-400 mb-2" />
                  {fileName ? (
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-900">{fileName}</p>
                      <p className="text-xs text-slate-500">{(fileSize! / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Click to upload APK/AAB</p>
                      <p className="text-xs text-slate-400 mt-1">Android only (iOS coming soon)</p>
                    </div>
                  )}
                </label>
                <div className="mt-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  Note: Mobile testing via Appium is in Phase 2. APK upload is stored for future use.
                </div>
              </div>
            )}

            {/* Authorization */}
            <div className="pt-4 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authorized}
                  onChange={(e) => setAuthorized(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">
                  I confirm that I own or have explicit authorization to test this application.
                  I understand this platform will only perform safe, non-destructive testing.
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-5 py-2.5 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Configure
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Configuration */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">Test Profile</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PROFILES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfile(p)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      profile === p
                        ? "border-blue-600 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className={`text-sm font-medium ${profile === p ? "text-blue-700" : "text-slate-900"}`}>
                      {PROFILE_LABELS[p]}
                    </p>
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">{PROFILE_DESCRIPTIONS[profile]}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Max Pages</label>
                <input
                  type="number"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  min={1}
                  max={100}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Max Test Cases</label>
                <input
                  type="number"
                  value={maxTestCases}
                  onChange={(e) => setMaxTestCases(Number(e.target.value))}
                  min={1}
                  max={200}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Crawl Depth</label>
                <input
                  type="number"
                  value={crawlDepth}
                  onChange={(e) => setCrawlDepth(Number(e.target.value))}
                  min={0}
                  max={5}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Rate Limit (ms)</label>
                <input
                  type="number"
                  value={rateLimitMs}
                  onChange={(e) => setRateLimitMs(Number(e.target.value))}
                  min={0}
                  max={5000}
                  step={100}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setStep(2)}
                className="px-5 py-2.5 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Start AI Testing
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
