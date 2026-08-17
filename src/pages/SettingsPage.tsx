import { Settings, ShieldCheck, Key, Cpu, Globe, Lock } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
          <Settings className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Platform configuration and AI provider settings</p>
        </div>
      </div>

      {/* AI Provider */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-600" />
          AI Provider Configuration
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          AI provider settings are managed through environment variables on the server.
          The platform supports provider-independent LLM integration — configure your
          provider and API key in the server environment.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">AI Provider</p>
                <p className="text-xs text-slate-500">OpenAI or Anthropic</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">Server configured</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">API Key</p>
                <p className="text-xs text-slate-500">Never hardcoded, never exposed to client</p>
              </div>
            </div>
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Secured
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900">Model</p>
                <p className="text-xs text-slate-500">Configurable via AI_MODEL env var</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">Server configured</span>
          </div>
        </div>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          When no AI key is configured, the platform uses a built-in heuristic test case
          generator that produces relevant functional, positive, negative, and smoke tests
          based on discovered page features.
        </div>
      </div>

      {/* Safety */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Safety & Authorization
        </h2>
        <div className="space-y-3">
          {[
            "Only test applications you own or have explicit authorization to test",
            "Credentials are protected and never exposed to the client",
            "No destructive production actions are performed by default",
            "Safe test data is used where possible",
            "Crawling and execution are rate-limited",
            "No uncontrolled security exploitation is performed",
            "Security testing remains authorized and controlled",
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          Platform Architecture
        </h2>
        <div className="text-sm text-slate-600 space-y-2">
          <p className="font-medium text-slate-900">MVP (Current):</p>
          <p>Website testing via HTTP-based discovery and execution with AI-generated test cases, bug validation, evidence collection, coverage analysis, and report generation.</p>
          <p className="font-medium text-slate-900 mt-4">Phase 2 (Architecture Ready):</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {["Playwright browser execution", "Appium mobile (Android/iOS)", "Auth workflows", "Role-based testing", "API testing", "Cross-browser testing", "Visual regression", "Performance testing", "Security testing", "Jira integration", "CI/CD", "Scheduled testing"].map((feature) => (
              <span key={feature} className="px-2.5 py-1 bg-slate-100 rounded-md text-xs text-slate-600">
                {feature}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
