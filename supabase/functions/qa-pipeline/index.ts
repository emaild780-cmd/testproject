import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { chromium } from "npm:playwright-core@1.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RunRequest {
  runId: string;
}

interface DiscoveredFeature {
  type: string;
  selector: string;
  label: string;
  attributes: Record<string, unknown>;
}

interface DiscoveredPage {
  url: string;
  title: string;
  depth: number;
  statusCode: number;
  loadTimeMs: number;
  consoleErrors: number;
  networkErrors: number;
  links: string[];
  features: DiscoveredFeature[];
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizeUrl(base: string, href: string): string | null {
  if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function sameOrigin(base: string, url: string): boolean {
  try {
    return new URL(base).origin === new URL(url).origin;
  } catch {
    return false;
  }
}

async function connectBrowser(): Promise<BrowserHandle> {
  const wsEndpoint = Deno.env.get("BROWSER_WS_ENDPOINT");

  if (wsEndpoint) {
    const browser = await chromium.connect({ wsEndpoint });
    return { browser, close: async () => browser.close(), isRemote: true };
  }

  try {
    const browser = await chromium.launch({ headless: true });
    return { browser, close: async () => browser.close(), isRemote: false };
  } catch {
    throw new Error(
      "No browser available. Set BROWSER_WS_ENDPOINT to a Playwright-compatible WebSocket endpoint (e.g. wss://chrome.browserless.io?token=YOUR_TOKEN).",
    );
  }
}

interface BrowserHandle {
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  close: () => Promise<void>;
  isRemote: boolean;
}

const DISCOVERY_SCRIPT = `() => {
  const features = [];
  const seen = new Set();
  const addFeature = (type, selector, label, attributes = {}) => {
    const key = type + ':' + selector + ':' + label;
    if (seen.has(key)) return;
    if (features.length >= 200) return;
    seen.add(key);
    features.push({ type, selector, label: (label || '').slice(0, 100), attributes });
  };
  const labelText = (el) => {
    if (el.labels && el.labels[0]) return el.labels[0].textContent.trim();
    return el.getAttribute('aria-label') || el.placeholder || el.name || el.id || '';
  };

  // Links
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = (a.textContent || '').trim().slice(0, 100) || href;
    addFeature('link', 'a[href]', text, { href });
  });

  // Navigation
  document.querySelectorAll('nav, [role="navigation"]').forEach((nav) => {
    addFeature('navigation', 'nav', 'Navigation', {});
    nav.querySelectorAll('a').forEach((a) => {
      addFeature('link', 'nav a', (a.textContent || '').trim().slice(0, 100) || 'nav link', { href: a.getAttribute('href') });
    });
  });

  // Pagination controls
  document.querySelectorAll('[class*="pagination"], [class*="pager"], [aria-label*="pagination"], nav[aria-label*="pagination"]').forEach((pg) => {
    addFeature('navigation', '.pagination', 'Pagination', { links: pg.querySelectorAll('a, button').length });
  });

  // Buttons
  document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach((btn) => {
    const label = (btn.textContent || '').trim() || btn.getAttribute('value') || btn.getAttribute('aria-label') || 'Button';
    addFeature('button', btn.tagName.toLowerCase(), label, { type: btn.getAttribute('type') || '', disabled: btn.disabled || false });
  });

  // Text inputs
  document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="image"])').forEach((input) => {
    const type = input.getAttribute('type') || 'text';
    const label = labelText(input) || type;
    const attrs = { type, name: input.name || '', placeholder: input.placeholder || '', required: input.required };
    if (type === 'search' || (label || '').toLowerCase().includes('search')) {
      attrs.searchField = true;
    }
    addFeature('input', 'input', label, attrs);
  });

  // Textareas
  document.querySelectorAll('textarea').forEach((ta) => {
    addFeature('input', 'textarea', labelText(ta) || 'Textarea', { name: ta.name || '', placeholder: ta.placeholder || '', required: ta.required });
  });

  // Selects / dropdowns
  document.querySelectorAll('select').forEach((sel) => {
    const attrs = { name: sel.name || '', options: sel.options.length, multiple: sel.multiple };
    if ((labelText(sel) || '').toLowerCase().includes('filter') || (sel.className || '').toLowerCase().includes('filter')) {
      attrs.filter = true;
    }
    addFeature('dropdown', 'select', labelText(sel) || 'Dropdown', attrs);
  });

  // Checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    addFeature('checkbox', 'input[type="checkbox"]', labelText(cb) || 'Checkbox', { name: cb.name || '', checked: cb.checked });
  });

  // Radios
  document.querySelectorAll('input[type="radio"]').forEach((r) => {
    addFeature('radio', 'input[type="radio"]', labelText(r) || 'Radio', { name: r.name || '', value: r.value || '' });
  });

  // Forms
  document.querySelectorAll('form').forEach((form) => {
    addFeature('form', 'form', 'Form', { action: form.action || '', method: (form.method || 'get').toLowerCase(), fields: form.elements.length });
  });

  // Tables
  document.querySelectorAll('table').forEach((table) => {
    addFeature('table', 'table', 'Data table', { rows: table.rows ? table.rows.length : 0 });
  });

  // Modals / dialogs
  document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"], .modal, .dialog').forEach((modal) => {
    addFeature('modal', 'dialog', 'Modal dialog', { open: modal.open || modal.getAttribute('aria-hidden') !== 'true' });
  });

  // Upload controls
  document.querySelectorAll('input[type="file"]').forEach((upload) => {
    addFeature('upload', 'input[type="file"]', labelText(upload) || 'File upload', { accept: upload.accept || '', multiple: upload.multiple });
  });

  // Download links
  document.querySelectorAll('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"]').forEach((dl) => {
    addFeature('download', 'a[download]', (dl.textContent || '').trim().slice(0, 100) || 'Download', { href: dl.getAttribute('href') || '' });
  });

  // Images
  let imgCount = 0;
  document.querySelectorAll('img').forEach((img) => {
    if (imgCount < 10) {
      addFeature('image', 'img', img.alt || (img.src || '').split('/').pop() || 'Image', { src: img.src || '', alt: img.alt || '' });
      imgCount++;
    }
  });

  // Filter-like controls (buttons/links with filter in label/class)
  document.querySelectorAll('[class*="filter"], [aria-label*="filter"], [data-filter]').forEach((el) => {
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
      addFeature('button', el.tagName.toLowerCase(), (el.textContent || '').trim().slice(0, 100) || 'Filter', { filter: true });
    }
  });

  // Visible interactive elements with tabindex or role
  document.querySelectorAll('[tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (!['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const label = (el.textContent || '').trim().slice(0, 100) || el.getAttribute('aria-label') || 'Interactive element';
      addFeature('text', el.tagName.toLowerCase(), label, { tabindex: el.getAttribute('tabindex'), interactive: true });
    }
  });

  // Internal links for crawling
  const internalLinks = [];
  const linkSet = new Set();
  document.querySelectorAll('a[href]').forEach((a) => {
    try {
      const abs = new URL(a.href, window.location.href).href;
      if (abs.startsWith(window.location.origin) && !linkSet.has(abs)) {
        linkSet.add(abs);
        internalLinks.push(abs);
      }
    } catch {}
  });

  return {
    url: window.location.href,
    title: document.title || 'Untitled',
    features,
    links: internalLinks.slice(0, 100),
  };
}`;

interface DiscoveryResult {
  url: string;
  title: string;
  features: DiscoveredFeature[];
  links: string[];
}

async function discoverPage(
  context: Awaited<ReturnType<BrowserHandle["browser"]["newContext"]>>,
  url: string,
  depth: number,
  timeoutMs: number,
  authCredentials?: { username: string; password: string },
): Promise<DiscoveredPage> {
  const page = await context.newPage();
  const consoleErrors: unknown[] = [];
  const networkErrors: unknown[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ message: msg.text(), type: "error" });
    }
  });
  page.on("requestfailed", (req) => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText || "Request failed" });
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), status: resp.status() });
    }
  });

  const start = Date.now();
  let statusCode = 0;

  try {
    const gotoOptions: Record<string, unknown> = {
      waitUntil: "networkidle" as const,
      timeout: timeoutMs,
    };
    if (authCredentials) {
      gotoOptions.httpCredentials = authCredentials;
    }

    const response = await page.goto(url, gotoOptions);
    statusCode = response?.status() ?? 0;

    // Wait for potential lazy-loaded content
    await page.waitForTimeout(1000).catch(() => {});

    const result = await page.evaluate(DISCOVERY_SCRIPT) as DiscoveryResult;

    const loadTimeMs = Date.now() - start;

    await page.close();

    return {
      url: result.url,
      title: result.title,
      depth,
      statusCode,
      loadTimeMs,
      consoleErrors: consoleErrors.length,
      networkErrors: networkErrors.length,
      links: result.links,
      features: result.features,
    };
  } catch (err) {
    const loadTimeMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : "Unknown error";

    await page.close().catch(() => {});

    return {
      url,
      title: "",
      depth,
      statusCode,
      loadTimeMs,
      consoleErrors: consoleErrors.length,
      networkErrors: networkErrors.length + 1,
      links: [],
      features: [],
    };
  }
}

async function discoverSite(
  browser: BrowserHandle,
  startUrl: string,
  maxPages: number,
  crawlDepth: number,
  rateLimitMs: number,
  timeoutMs: number,
  authCredentials?: { username: string; password: string },
): Promise<DiscoveredPage[]> {
  const context = await browser.browser.newContext({
    userAgent: "QAPlatform-Bot/1.0 (AI Testing; Playwright)",
    viewport: { width: 1280, height: 720 },
  });

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
  const pages: DiscoveredPage[] = [];

  try {
    while (queue.length > 0 && pages.length < maxPages) {
      const { url, depth } = queue.shift()!;
      if (visited.has(url)) continue;
      visited.add(url);

      const page = await discoverPage(context, url, depth, timeoutMs, authCredentials);
      pages.push(page);

      if (depth < crawlDepth && page.links.length > 0) {
        for (const link of page.links) {
          if (!visited.has(link) && sameOrigin(startUrl, link) && pages.length + queue.length < maxPages) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }

      if (rateLimitMs > 0 && queue.length > 0) {
        await new Promise((r) => setTimeout(r, rateLimitMs));
      }
    }
  } finally {
    await context.close().catch(() => {});
  }

  return pages;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let runId: string | null = null;

  try {
    const { runId: reqRunId } = await req.json() as RunRequest;
    runId = reqRunId;

    if (!runId) {
      return new Response(JSON.stringify({ error: "runId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .select(`
        *,
        targets!inner(*),
        test_configurations!inner(*)
      `)
      .eq("id", runId)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = run.targets;
    const config = run.test_configurations;

    if (target.type !== "website" || !target.url) {
      return new Response(JSON.stringify({ error: "Only website targets are supported" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate URL
    try {
      const parsed = new URL(target.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      await supabase.from("test_runs").update({
        status: "failed",
        error_message: "Invalid target URL",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: "Invalid target URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update run status to discovering
    await supabase.from("test_runs").update({
      status: "discovering",
      current_phase: "Opening target website in browser and discovering application",
      progress: 5,
      started_at: new Date().toISOString(),
    }).eq("id", runId);

    // Connect to browser
    let browser: BrowserHandle;
    try {
      browser = await connectBrowser();
    } catch (browserErr) {
      const msg = browserErr instanceof Error ? browserErr.message : "Failed to connect to browser";
      await supabase.from("test_runs").update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth credentials if needed
    const authCredentials = target.auth_required && target.auth_username && target.auth_password
      ? { username: target.auth_username, password: target.auth_password }
      : undefined;

    let pages: DiscoveredPage[] = [];
    try {
      pages = await discoverSite(
        browser,
        target.url,
        config.max_pages,
        config.crawl_depth,
        config.rate_limit_ms,
        config.timeout_ms,
        authCredentials,
      );
    } catch (discoverErr) {
      const msg = discoverErr instanceof Error ? discoverErr.message : "Discovery failed";
      await browser.close().catch(() => {});
      await supabase.from("test_runs").update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await browser.close().catch(() => {});
    }

    if (pages.length === 0) {
      await supabase.from("test_runs").update({
        status: "failed",
        error_message: "No pages could be discovered. The target URL may be unreachable or blocked.",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: "No pages discovered" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("test_runs").update({
      current_phase: "Storing discovered pages and features",
      progress: 50,
    }).eq("id", runId);

    // Insert app_pages
    const pageRecords = pages.map((p) => ({
      run_id: runId,
      url: p.url,
      title: p.title,
      depth: p.depth,
      status: p.statusCode >= 400 ? "failed" as const : "discovered" as const,
      status_code: p.statusCode,
      load_time_ms: p.loadTimeMs,
      console_errors: p.consoleErrors,
      network_errors: p.networkErrors,
    }));

    const { data: insertedPages, error: pagesError } = await supabase
      .from("app_pages")
      .insert(pageRecords)
      .select();

    if (pagesError) {
      throw new Error("Failed to store discovered pages: " + pagesError.message);
    }

    const pageIdMap = new Map<string, string>();
    if (insertedPages) {
      insertedPages.forEach((p, i) => {
        pageIdMap.set(pages[i].url, p.id);
      });
    }

    // Insert features
    const featureRecords: Record<string, unknown>[] = [];
    for (const p of pages) {
      const pageId = pageIdMap.get(p.url);
      if (!pageId) continue;
      for (const f of p.features) {
        featureRecords.push({
          run_id: runId,
          page_id: pageId,
          type: f.type,
          selector: f.selector,
          label: f.label,
          attributes: f.attributes,
        });
      }
    }

    let totalFeatures = 0;
    if (featureRecords.length > 0) {
      const { error: featuresError } = await supabase.from("features").insert(featureRecords);
      if (featuresError) {
        throw new Error("Failed to store discovered features: " + featuresError.message);
      }
      totalFeatures = featureRecords.length;
    }

    await supabase.from("test_runs").update({
      current_phase: "Calculating coverage",
      progress: 80,
    }).eq("id", runId);

    // Store coverage record (discovery only — no tests yet)
    const pagesDiscovered = pages.length;
    const pagesTested = 0;
    const featuresDiscovered = totalFeatures;
    const featuresTested = 0;
    const coveragePct = 0;

    const untestedAreas = pages.map((p) => ({
      url: p.url,
      title: p.title,
      reason: "Discovery complete — test generation pending",
    }));

    await supabase.from("coverage").insert({
      run_id: runId,
      pages_discovered: pagesDiscovered,
      pages_tested: pagesTested,
      features_discovered: featuresDiscovered,
      features_tested: featuresTested,
      workflows_discovered: 0,
      workflows_tested: 0,
      test_cases_generated: 0,
      test_cases_executed: 0,
      passed: 0,
      failed: 0,
      blocked: 0,
      coverage_percentage: coveragePct,
      untested_areas: untestedAreas,
      techniques_used: [],
    });

    // Final update — discovery complete
    await supabase.from("test_runs").update({
      status: "completed",
      current_phase: "Discovery completed — ready for test generation",
      progress: 100,
      coverage_percentage: 0,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true,
      runId,
      phase: "discovery",
      summary: {
        pagesDiscovered: pages.length,
        featuresDiscovered: totalFeatures,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    if (runId) {
      await supabase.from("test_runs").update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq("id", runId).then(() => {}, () => {});
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
