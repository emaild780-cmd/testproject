import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

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
  error?: string;
}

interface GeneratedTestCase {
  case_id: string;
  module_page: string;
  scenario: string;
  technique: string;
  preconditions: string;
  test_data: Record<string, unknown>;
  steps: { action: string; target: string; expected: string }[];
  expected_result: string;
  page_id: string;
  feature_id: string | null;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function sameOrigin(base: string, url: string): boolean {
  try {
    return new URL(base).origin === new URL(url).origin;
  } catch {
    return false;
  }
}

// === BROWSER CONNECTION ===

interface BrowserHandle {
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  close: () => Promise<void>;
}

async function connectBrowser(): Promise<BrowserHandle> {
  const wsEndpoint = Deno.env.get("BROWSER_WS_ENDPOINT");
  if (wsEndpoint) {
    const browser = await chromium.connect({ wsEndpoint });
    return { browser, close: async () => browser.close() };
  }
  try {
    const browser = await chromium.launch({ headless: true });
    return { browser, close: async () => browser.close() };
  } catch {
    throw new Error(
      "No browser available. Set BROWSER_WS_ENDPOINT to a Playwright-compatible WebSocket endpoint.",
    );
  }
}

// === IN-PAGE DISCOVERY SCRIPT ===

const DISCOVERY_SCRIPT = `(() => {
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

  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const text = (a.textContent || '').trim().slice(0, 100) || href;
    addFeature('link', 'a[href]', text, { href });
  });

  document.querySelectorAll('nav, [role="navigation"]').forEach((nav) => {
    addFeature('navigation', 'nav', 'Navigation', {});
    nav.querySelectorAll('a').forEach((a) => {
      addFeature('link', 'nav a', (a.textContent || '').trim().slice(0, 100) || 'nav link', { href: a.getAttribute('href') });
    });
  });

  document.querySelectorAll('[class*="pagination"], [class*="pager"], [aria-label*="pagination"]').forEach((pg) => {
    addFeature('navigation', '.pagination', 'Pagination', { links: pg.querySelectorAll('a, button').length });
  });

  document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]').forEach((btn) => {
    const label = (btn.textContent || '').trim() || btn.getAttribute('value') || btn.getAttribute('aria-label') || 'Button';
    addFeature('button', btn.tagName.toLowerCase(), label, { type: btn.getAttribute('type') || '', disabled: btn.disabled || false });
  });

  document.querySelectorAll('input:not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="image"])').forEach((input) => {
    const type = input.getAttribute('type') || 'text';
    const label = labelText(input) || type;
    const attrs = { type, name: input.name || '', placeholder: input.placeholder || '', required: input.required };
    if (type === 'search' || (label || '').toLowerCase().includes('search')) attrs.searchField = true;
    addFeature('input', 'input', label, attrs);
  });

  document.querySelectorAll('textarea').forEach((ta) => {
    addFeature('input', 'textarea', labelText(ta) || 'Textarea', { name: ta.name || '', placeholder: ta.placeholder || '', required: ta.required });
  });

  document.querySelectorAll('select').forEach((sel) => {
    const attrs = { name: sel.name || '', options: sel.options.length, multiple: sel.multiple };
    if ((labelText(sel) || '').toLowerCase().includes('filter') || (sel.className || '').toLowerCase().includes('filter')) attrs.filter = true;
    addFeature('dropdown', 'select', labelText(sel) || 'Dropdown', attrs);
  });

  document.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    addFeature('checkbox', 'input[type="checkbox"]', labelText(cb) || 'Checkbox', { name: cb.name || '', checked: cb.checked });
  });

  document.querySelectorAll('input[type="radio"]').forEach((r) => {
    addFeature('radio', 'input[type="radio"]', labelText(r) || 'Radio', { name: r.name || '', value: r.value || '' });
  });

  document.querySelectorAll('form').forEach((form) => {
    addFeature('form', 'form', 'Form', { action: form.action || '', method: (form.method || 'get').toLowerCase(), fields: form.elements.length });
  });

  document.querySelectorAll('table').forEach((table) => {
    addFeature('table', 'table', 'Data table', { rows: table.rows ? table.rows.length : 0 });
  });

  document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"], .modal, .dialog').forEach((modal) => {
    addFeature('modal', 'dialog', 'Modal dialog', { open: modal.open || modal.getAttribute('aria-hidden') !== 'true' });
  });

  document.querySelectorAll('input[type="file"]').forEach((upload) => {
    addFeature('upload', 'input[type="file"]', labelText(upload) || 'File upload', { accept: upload.accept || '', multiple: upload.multiple });
  });

  document.querySelectorAll('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".doc"], a[href$=".docx"], a[href$=".xls"], a[href$=".xlsx"]').forEach((dl) => {
    addFeature('download', 'a[download]', (dl.textContent || '').trim().slice(0, 100) || 'Download', { href: dl.getAttribute('href') || '' });
  });

  let imgCount = 0;
  document.querySelectorAll('img').forEach((img) => {
    if (imgCount < 10) {
      addFeature('image', 'img', img.alt || (img.src || '').split('/').pop() || 'Image', { src: img.src || '', alt: img.alt || '' });
      imgCount++;
    }
  });

  document.querySelectorAll('[class*="filter"], [aria-label*="filter"], [data-filter]').forEach((el) => {
    if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') {
      addFeature('button', el.tagName.toLowerCase(), (el.textContent || '').trim().slice(0, 100) || 'Filter', { filter: true });
    }
  });

  document.querySelectorAll('[tabindex]:not([tabindex="-1"])').forEach((el) => {
    if (!['INPUT', 'BUTTON', 'A', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
      const label = (el.textContent || '').trim().slice(0, 100) || el.getAttribute('aria-label') || 'Interactive element';
      addFeature('text', el.tagName.toLowerCase(), label, { tabindex: el.getAttribute('tabindex'), interactive: true });
    }
  });

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
})()`;

// === PAGE DISCOVERY ===

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
    if (msg.type() === "error") consoleErrors.push({ message: msg.text() });
  });
  page.on("requestfailed", (req) => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText || "Request failed" });
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400) networkErrors.push({ url: resp.url(), status: resp.status() });
  });

  const start = Date.now();
  let statusCode = 0;

  try {
    const gotoOptions: Record<string, unknown> = {
      waitUntil: "networkidle" as const,
      timeout: timeoutMs,
    };
    if (authCredentials) gotoOptions.httpCredentials = authCredentials;

    const response = await page.goto(url, gotoOptions);
    statusCode = response?.status() ?? 0;
    await page.waitForTimeout(1000).catch(() => {});

    const rawResult = await page.evaluate(DISCOVERY_SCRIPT);
    if (!rawResult || typeof rawResult !== "object") {
      throw new Error("Discovery script returned no result — page may be blocked or empty");
    }
    const result = rawResult as { url: string; title: string; features: DiscoveredFeature[]; links: string[] };

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
      url, title: "", depth, statusCode, loadTimeMs,
      consoleErrors: consoleErrors.length,
      networkErrors: networkErrors.length + 1,
      links: [], features: [], error: errorMsg,
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
      if (rateLimitMs > 0 && queue.length > 0) await new Promise((r) => setTimeout(r, rateLimitMs));
    }
  } finally {
    await context.close().catch(() => {});
  }
  return pages;
}

// === TEST CASE GENERATION ===

function inferInputType(label: string, attrs: Record<string, unknown>): string {
  const type = (attrs.type as string) || "text";
  const l = label.toLowerCase();
  if (type === "password" || l.includes("password")) return "password";
  if (type === "email" || l.includes("email")) return "email";
  if (type === "tel" || l.includes("phone") || l.includes("mobile")) return "phone";
  if (type === "number" || l.includes("age") || l.includes("amount") || l.includes("quantity")) return "number";
  if (type === "url" || l.includes("website") || l.includes("url")) return "url";
  if (type === "search" || l.includes("search")) return "search";
  return "text";
}

function sampleValue(inputType: string): string {
  switch (inputType) {
    case "email": return "test@example.com";
    case "password": return "TestPassword123!";
    case "phone": return "5551234567";
    case "number": return "42";
    case "url": return "https://example.com";
    case "search": return "test query";
    default: return "Test Input Value";
  }
}

function invalidValue(inputType: string): string {
  switch (inputType) {
    case "email": return "not-an-email";
    case "password": return "a";
    case "phone": return "abc";
    case "number": return "not-a-number";
    case "url": return "not-a-url";
    default: return "";
  }
}

interface StoredFeature {
  id: string;
  page_id: string;
  type: string;
  selector: string;
  label: string;
  attributes: Record<string, unknown>;
  page_url: string;
  page_title: string;
}

function generateFeatureTestCases(feature: StoredFeature, counter: { n: number }): GeneratedTestCase[] {
  const cases: GeneratedTestCase[] = [];
  const pageLabel = feature.page_title || feature.page_url;
  const label = feature.label || feature.type;
  const attrs = feature.attributes;
  const pre = `Page ${feature.page_url} is loaded and accessible`;

  const mk = (
    scenario: string, technique: string, preconditions: string,
    testData: Record<string, unknown>,
    steps: { action: string; target: string; expected: string }[],
    expectedResult: string,
  ): GeneratedTestCase => {
    counter.n++;
    return {
      case_id: `TC-${String(counter.n).padStart(3, "0")}`,
      module_page: pageLabel, scenario, technique, preconditions, test_data: testData,
      steps, expected_result: expectedResult,
      page_id: feature.page_id, feature_id: feature.id,
    };
  };

  switch (feature.type) {
    case "form": {
      const fieldCount = (attrs.fields as number) || 1;
      cases.push(mk(
        `Verify form on "${pageLabel}" submits successfully with valid data`,
        "positive", pre, { formData: "valid test data for all fields" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads successfully" },
          { action: "fill", target: `form fields (${fieldCount} fields)`, expected: "All fields accept valid input" },
          { action: "submit", target: label, expected: "Form submits without errors" },
          { action: "verify", target: "success response or redirect", expected: "Application confirms successful submission" },
        ],
        "Form accepts valid data and shows a success response or redirects to a confirmation page",
      ));
      cases.push(mk(
        `Verify form on "${pageLabel}" rejects submission with all fields empty`,
        "negative", pre, { formData: "all fields empty" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads successfully" },
          { action: "submit", target: label, expected: "Form does not submit" },
          { action: "verify", target: "validation error messages", expected: "Validation errors are displayed for required fields" },
        ],
        "Form prevents submission and displays validation error messages for empty required fields",
      ));
      cases.push(mk(
        `Verify form on "${pageLabel}" handles invalid input data gracefully`,
        "negative", pre, { formData: "invalid data (special characters, malformed values)" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads successfully" },
          { action: "fill", target: "form fields with invalid data", expected: "Fields accept input" },
          { action: "submit", target: label, expected: "Form rejects invalid data" },
          { action: "verify", target: "error messages", expected: "Appropriate validation errors are shown" },
        ],
        "Form rejects invalid data and displays meaningful validation error messages",
      ));
      cases.push(mk(
        `Verify form on "${pageLabel}" preserves data on validation failure`,
        "validation", pre, { formData: "partially valid data" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "fill", target: "some fields with valid data, leave required field empty", expected: "Fields accept input" },
          { action: "submit", target: label, expected: "Form shows validation error" },
          { action: "verify", target: "previously entered data", expected: "Valid fields retain their values" },
        ],
        "Form preserves valid user input when validation fails on other fields",
      ));
      break;
    }

    case "input": {
      const inputType = inferInputType(label, attrs);
      const validVal = sampleValue(inputType);
      const invalidVal = invalidValue(inputType);
      const isRequired = attrs.required === true;
      const placeholder = (attrs.placeholder as string) || "";

      cases.push(mk(
        `Verify "${label}" input field on "${pageLabel}" accepts valid ${inputType} input`,
        "positive", pre, { inputValue: validVal },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "type", target: label, expected: "Input field accepts the value" },
          { action: "verify", target: "displayed value", expected: `Field shows "${validVal}"` },
        ],
        `Input field accepts and displays valid ${inputType} input`,
      ));

      if (isRequired) {
        cases.push(mk(
          `Verify "${label}" input field on "${pageLabel}" shows validation error when left empty`,
          "negative", pre, { inputValue: "" },
          [
            { action: "navigate", target: feature.page_url, expected: "Page loads" },
            { action: "submit", target: "associated form", expected: "Form validation triggers" },
            { action: "verify", target: label, expected: "Validation error is shown for empty required field" },
          ],
          "Required input field shows a validation error when submitted empty",
        ));
      }

      cases.push(mk(
        `Verify "${label}" input field on "${pageLabel}" rejects invalid ${inputType} input`,
        "negative", pre, { inputValue: invalidVal },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "type", target: label, expected: "Field accepts input" },
          { action: "submit", target: "associated form", expected: "Form validates" },
          { action: "verify", target: "validation message", expected: `Error shown for invalid ${inputType}` },
        ],
        `Input field rejects invalid ${inputType} input and shows a validation message`,
      ));

      cases.push(mk(
        `Verify "${label}" field on "${pageLabel}" handles minimum length input (boundary value)`,
        "boundary_value", pre, { inputValue: "a" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "type", target: label, expected: "Field accepts minimum input" },
          { action: "verify", target: "field value", expected: "Value is accepted or validation message shown" },
        ],
        "Input field handles minimum-length input correctly",
      ));
      cases.push(mk(
        `Verify "${label}" field on "${pageLabel}" handles maximum length input (boundary value)`,
        "boundary_value", pre, { inputValue: "A".repeat(200) },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "type", target: label, expected: "Field accepts or truncates input" },
          { action: "verify", target: "field value", expected: "Value is accepted or validation message shown" },
        ],
        "Input field handles maximum-length input correctly",
      ));

      cases.push(mk(
        `Verify "${label}" field on "${pageLabel}" equivalence class: empty input`,
        "equivalence_partitioning", pre, { inputValue: "" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "type", target: label, expected: "Field is empty" },
          { action: "submit", target: "associated form", expected: isRequired ? "Validation error shown" : "Form processes empty input" },
        ],
        isRequired ? "Empty input class triggers required-field validation" : "Empty input class is accepted for optional field",
      ));

      if (placeholder) {
        cases.push(mk(
          `Verify "${label}" field on "${pageLabel}" displays placeholder text when empty`,
          "ui", pre, {},
          [
            { action: "navigate", target: feature.page_url, expected: "Page loads" },
            { action: "verify", target: label, expected: `Placeholder "${placeholder}" is visible` },
          ],
          "Input field displays correct placeholder text when empty",
        ));
      }
      break;
    }

    case "button": {
      const isDisabled = attrs.disabled === true;
      cases.push(mk(
        `Verify "${label}" button on "${pageLabel}" is clickable and responds`,
        "functional", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Button responds to click" },
          { action: "verify", target: "resulting action", expected: "Expected action is triggered (navigation, modal, API call, etc.)" },
        ],
        "Button is clickable and triggers its intended action",
      ));
      if (isDisabled) {
        cases.push(mk(
          `Verify disabled "${label}" button on "${pageLabel}" does not trigger action when clicked`,
          "negative", pre, {},
          [
            { action: "navigate", target: feature.page_url, expected: "Page loads" },
            { action: "click", target: label, expected: "No action is triggered" },
            { action: "verify", target: "page state", expected: "Page remains unchanged" },
          ],
          "Disabled button does not trigger any action when clicked",
        ));
      }
      cases.push(mk(
        `Verify "${label}" button on "${pageLabel}" has visible focus state`,
        "accessibility", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "focus", target: label, expected: "Button receives focus" },
          { action: "verify", target: "focus indicator", expected: "Visible focus outline or style change is present" },
        ],
        "Button has a visible focus indicator for keyboard navigation",
      ));
      break;
    }

    case "link": {
      const href = (attrs.href as string) || "";
      cases.push(mk(
        `Verify "${label}" link on "${pageLabel}" navigates to correct destination`,
        "functional", pre, { href },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Link navigates to destination" },
          { action: "verify", target: "destination URL", expected: `URL matches or relates to "${href}"` },
        ],
        "Link navigates to the correct destination without errors",
      ));
      cases.push(mk(
        `Verify "${label}" link on "${pageLabel}" is not broken`,
        "smoke", pre, { href },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Navigation occurs" },
          { action: "verify", target: "destination page", expected: "Destination page loads with HTTP 200 and no error" },
        ],
        "Link is not broken — destination page loads successfully",
      ));
      break;
    }

    case "dropdown": {
      const optionCount = (attrs.options as number) || 1;
      cases.push(mk(
        `Verify "${label}" dropdown on "${pageLabel}" displays all ${optionCount} options`,
        "functional", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Dropdown opens" },
          { action: "verify", target: "dropdown options", expected: `All ${optionCount} options are visible` },
        ],
        `Dropdown displays all ${optionCount} available options`,
      ));
      cases.push(mk(
        `Verify "${label}" dropdown on "${pageLabel}" allows selecting an option`,
        "positive", pre, { selectedOption: "first available option" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Dropdown opens" },
          { action: "select", target: "first option", expected: "Option is selected" },
          { action: "verify", target: "selected value", expected: "Selected value is displayed in the dropdown" },
        ],
        "Dropdown allows selecting an option and displays the selection",
      ));
      if (attrs.filter === true) {
        cases.push(mk(
          `Verify "${label}" filter dropdown on "${pageLabel}" filters content when an option is selected`,
          "functional", pre, { selectedFilter: "first option" },
          [
            { action: "navigate", target: feature.page_url, expected: "Page loads" },
            { action: "select", target: label, expected: "Filter option is selected" },
            { action: "verify", target: "filtered content", expected: "Content updates to match the selected filter" },
          ],
          "Filter dropdown correctly filters displayed content",
        ));
      }
      break;
    }

    case "checkbox": {
      cases.push(mk(
        `Verify "${label}" checkbox on "${pageLabel}" can be checked`,
        "functional", pre, { checked: true },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Checkbox becomes checked" },
          { action: "verify", target: "checkbox state", expected: "Checkbox shows checked state" },
        ],
        "Checkbox can be checked and reflects the checked state",
      ));
      cases.push(mk(
        `Verify "${label}" checkbox on "${pageLabel}" can be unchecked (state transition)`,
        "state_transition", pre, { checked: false },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Checkbox is checked" },
          { action: "click", target: label, expected: "Checkbox is unchecked" },
          { action: "verify", target: "checkbox state", expected: "Checkbox shows unchecked state" },
        ],
        "Checkbox can be toggled from checked to unchecked state",
      ));
      break;
    }

    case "radio": {
      cases.push(mk(
        `Verify "${label}" radio button on "${pageLabel}" can be selected`,
        "functional", pre, { selected: true },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Radio button is selected" },
          { action: "verify", target: "radio state", expected: "Radio button shows selected state" },
        ],
        "Radio button can be selected and reflects the selected state",
      ));
      cases.push(mk(
        `Verify radio group containing "${label}" on "${pageLabel}" allows only one selection (decision table)`,
        "decision_table", pre, { selectedValue: (attrs.value as string) || label },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "This radio is selected" },
          { action: "click", target: "another radio in same group", expected: "Other radio becomes selected" },
          { action: "verify", target: label, expected: "This radio is now deselected" },
        ],
        "Selecting another radio button in the same group deselects the previous one",
      ));
      break;
    }

    case "table": {
      const rowCount = (attrs.rows as number) || 1;
      cases.push(mk(
        `Verify data table on "${pageLabel}" renders with ${rowCount} rows`,
        "functional", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: "table", expected: `Table is visible with ${rowCount} rows` },
          { action: "verify", target: "table headers", expected: "Column headers are present and readable" },
        ],
        `Table renders correctly with ${rowCount} rows and visible headers`,
      ));
      cases.push(mk(
        `Verify data table on "${pageLabel}" displays readable data in each cell`,
        "ui", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: "table cells", expected: "Cell content is visible and not truncated or overflowing" },
        ],
        "All table cells display data in a readable format",
      ));
      break;
    }

    case "modal": {
      cases.push(mk(
        `Verify modal dialog on "${pageLabel}" can be opened and closed (state transition)`,
        "state_transition", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: "modal", expected: "Modal is visible or can be triggered" },
          { action: "click", target: "close button or overlay", expected: "Modal closes" },
          { action: "verify", target: "modal visibility", expected: "Modal is no longer visible" },
        ],
        "Modal dialog can be opened and closed correctly",
      ));
      cases.push(mk(
        `Verify modal dialog on "${pageLabel}" traps keyboard focus when open`,
        "accessibility", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "open", target: "modal", expected: "Modal opens" },
          { action: "press", target: "Tab key repeatedly", expected: "Focus cycles within modal" },
          { action: "verify", target: "focused element", expected: "Focus remains inside the modal" },
        ],
        "Keyboard focus is trapped within the modal while it is open",
      ));
      break;
    }

    case "upload": {
      cases.push(mk(
        `Verify "${label}" file upload on "${pageLabel}" accepts valid file selection`,
        "positive", pre, { fileName: "test-file.txt", fileSize: "1KB" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "upload", target: label, expected: "File is selected" },
          { action: "verify", target: "upload status", expected: "File name is displayed or upload begins" },
        ],
        "File upload control accepts a valid file and shows confirmation",
      ));
      cases.push(mk(
        `Verify "${label}" file upload on "${pageLabel}" handles no-file-selected state`,
        "negative", pre, { fileName: "" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "submit", target: "associated form without selecting a file", expected: "Form validates" },
          { action: "verify", target: "validation message", expected: "Upload field shows validation if required" },
        ],
        "File upload control handles empty state with appropriate validation",
      ));
      break;
    }

    case "download": {
      cases.push(mk(
        `Verify "${label}" download link on "${pageLabel}" initiates download`,
        "functional", pre, { href: (attrs.href as string) || "" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "click", target: label, expected: "Download is initiated" },
          { action: "verify", target: "download response", expected: "File download begins or opens in browser" },
        ],
        "Download link initiates the file download correctly",
      ));
      break;
    }

    case "navigation": {
      cases.push(mk(
        `Verify navigation element on "${pageLabel}" is visible and contains links`,
        "ui", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: "navigation element", expected: "Navigation is visible" },
          { action: "verify", target: "navigation links", expected: "Links are present and clickable" },
        ],
        "Navigation element is visible with accessible links",
      ));
      break;
    }

    case "image": {
      const altText = (attrs.alt as string) || "";
      cases.push(mk(
        `Verify image "${label}" on "${pageLabel}" loads and displays correctly`,
        "ui", pre, { src: (attrs.src as string) || "" },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: label, expected: "Image is visible and rendered" },
          { action: "verify", target: "image source", expected: "Image loads without broken-link error" },
        ],
        "Image loads and displays correctly without broken references",
      ));
      cases.push(mk(
        `Verify image "${label}" on "${pageLabel}" has alt text for accessibility`,
        "accessibility", pre, { altText },
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: `${label} alt attribute`, expected: altText ? `Alt text "${altText}" is present` : "Alt attribute exists (may be empty for decorative images)" },
        ],
        "Image has appropriate alt text for screen reader accessibility",
      ));
      break;
    }

    case "text": {
      cases.push(mk(
        `Verify interactive text element "${label}" on "${pageLabel}" is visible and focusable`,
        "ui", pre, {},
        [
          { action: "navigate", target: feature.page_url, expected: "Page loads" },
          { action: "verify", target: label, expected: "Element is visible on the page" },
          { action: "focus", target: label, expected: "Element can receive keyboard focus" },
        ],
        "Interactive text element is visible and accessible via keyboard",
      ));
      break;
    }
  }

  return cases;
}

function generatePageLevelTestCases(
  pageId: string,
  page: { url: string; title: string; statusCode: number; consoleErrors: number; networkErrors: number },
  counter: { n: number },
): GeneratedTestCase[] {
  const cases: GeneratedTestCase[] = [];
  const pageLabel = page.title || page.url;

  const mk = (
    scenario: string, technique: string, preconditions: string,
    testData: Record<string, unknown>,
    steps: { action: string; target: string; expected: string }[],
    expectedResult: string,
  ): GeneratedTestCase => {
    counter.n++;
    return {
      case_id: `TC-${String(counter.n).padStart(3, "0")}`,
      module_page: pageLabel, scenario, technique, preconditions, test_data: testData,
      steps, expected_result: expectedResult,
      page_id: pageId, feature_id: null,
    };
  };

  cases.push(mk(
    `Verify "${pageLabel}" page loads successfully`,
    "smoke", "Target application is accessible", { url: page.url },
    [
      { action: "navigate", target: page.url, expected: "Page loads" },
      { action: "verify", target: "HTTP status", expected: `Status code is 2xx or 3xx (got ${page.statusCode})` },
      { action: "verify", target: "page content", expected: "Page renders visible content" },
    ],
    "Page loads successfully with a valid HTTP status and visible content",
  ));

  cases.push(mk(
    `Verify "${pageLabel}" page displays expected title and content`,
    "functional", "Page URL is reachable", { url: page.url },
    [
      { action: "navigate", target: page.url, expected: "Page loads" },
      { action: "verify", target: "page title", expected: "Title is present and non-empty" },
      { action: "verify", target: "main content area", expected: "Content is visible and rendered" },
    ],
    "Page displays a valid title and rendered content",
  ));

  cases.push(mk(
    `Verify "${pageLabel}" page renders correctly on mobile viewport`,
    "ui", "Page URL is reachable", { viewport: "375x667 (mobile)" },
    [
      { action: "navigate", target: page.url, expected: "Page loads" },
      { action: "resize", target: "viewport to 375x667", expected: "Layout adapts to mobile width" },
      { action: "verify", target: "layout", expected: "No horizontal scroll, content fits within viewport" },
    ],
    "Page layout adapts correctly to mobile viewport without horizontal scroll",
  ));

  cases.push(mk(
    `Verify "${pageLabel}" page has no critical accessibility issues`,
    "accessibility", "Page URL is reachable", {},
    [
      { action: "navigate", target: page.url, expected: "Page loads" },
      { action: "verify", target: "lang attribute on <html>", expected: "Lang attribute is present" },
      { action: "verify", target: "page structure", expected: "At least one heading (h1-h6) is present" },
      { action: "verify", target: "images", expected: "Images have alt attributes" },
    ],
    "Page passes basic accessibility checks (lang attribute, headings, image alt text)",
  ));

  cases.push(mk(
    `Verify "${pageLabel}" page uses HTTPS and has no mixed content`,
    "security", "Page URL is reachable", { url: page.url },
    [
      { action: "navigate", target: page.url, expected: "Page loads over HTTPS" },
      { action: "verify", target: "protocol", expected: "Page is served via HTTPS" },
      { action: "verify", target: "resource URLs", expected: "No HTTP resources loaded on HTTPS page" },
    ],
    "Page is served over HTTPS with no mixed-content warnings",
  ));

  if (page.consoleErrors > 0 || page.networkErrors > 0) {
    cases.push(mk(
      `Verify "${pageLabel}" page handles console and network errors gracefully`,
      "error_handling", "Page URL is reachable",
      { consoleErrors: page.consoleErrors, networkErrors: page.networkErrors },
      [
        { action: "navigate", target: page.url, expected: "Page loads" },
        { action: "verify", target: "console errors", expected: `Console errors observed during discovery: ${page.consoleErrors}` },
        { action: "verify", target: "network errors", expected: `Network errors observed: ${page.networkErrors}` },
        { action: "verify", target: "page functionality", expected: "Page remains usable despite errors" },
      ],
      "Page handles console and network errors without breaking core functionality",
    ));
  }

  cases.push(mk(
    `Verify "${pageLabel}" page loads consistently on repeat visit (regression)`,
    "regression", "Page was previously verified as working", { url: page.url },
    [
      { action: "navigate", target: page.url, expected: "Page loads on first visit" },
      { action: "navigate", target: page.url, expected: "Page loads on second visit" },
      { action: "verify", target: "page state", expected: "Page renders the same content both times" },
    ],
    "Page loads consistently across multiple visits without regression",
  ));

  return cases;
}

async function generateAllTestCases(
  runId: string,
  pages: DiscoveredPage[],
  pageIdMap: Map<string, string>,
  maxTestCases: number,
): Promise<{ cases: GeneratedTestCase[]; techniquesUsed: string[] }> {
  const { data: storedFeatures, error: featuresError } = await supabase
    .from("features")
    .select(`id, page_id, type, selector, label, attributes, app_pages!inner(url, title)`)
    .eq("run_id", runId);

  if (featuresError) {
    throw new Error("Failed to fetch features for test generation: " + featuresError.message);
  }

  const counter = { n: 0 };
  const allCases: GeneratedTestCase[] = [];
  const techniquesSet = new Set<string>();

  for (const page of pages) {
    if (allCases.length >= maxTestCases) break;
    const pageId = pageIdMap.get(page.url);
    if (!pageId) continue;

    const pageCases = generatePageLevelTestCases(pageId, {
      url: page.url, title: page.title,
      statusCode: page.statusCode,
      consoleErrors: page.consoleErrors,
      networkErrors: page.networkErrors,
    }, counter);

    for (const tc of pageCases) {
      if (allCases.length >= maxTestCases) break;
      allCases.push(tc);
      techniquesSet.add(tc.technique);
    }
  }

  if (storedFeatures) {
    for (const sf of storedFeatures) {
      if (allCases.length >= maxTestCases) break;
      const pageData = sf.app_pages as unknown as { url: string; title: string };
      const storedFeature: StoredFeature = {
        id: sf.id, page_id: sf.page_id, type: sf.type,
        selector: sf.selector, label: sf.label,
        attributes: sf.attributes as Record<string, unknown>,
        page_url: pageData?.url || "",
        page_title: pageData?.title || "",
      };
      const featureCases = generateFeatureTestCases(storedFeature, counter);
      for (const tc of featureCases) {
        if (allCases.length >= maxTestCases) break;
        allCases.push(tc);
        techniquesSet.add(tc.technique);
      }
    }
  }

  return { cases: allCases, techniquesUsed: [...techniquesSet] };
}

// === MAIN HANDLER ===

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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: run, error: runError } = await supabase
      .from("test_runs")
      .select(`*, targets!inner(*), test_configurations!inner(*)`)
      .eq("id", runId).single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: "Run not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const target = run.targets;
    const config = run.test_configurations;

    if (target.type !== "website" || !target.url) {
      return new Response(JSON.stringify({ error: "Only website targets are supported" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const parsed = new URL(target.url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
    } catch {
      await supabase.from("test_runs").update({
        status: "failed", error_message: "Invalid target URL",
        completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: "Invalid target URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === DISCOVERY PHASE ===
    await supabase.from("test_runs").update({
      status: "discovering",
      current_phase: "Opening target website in browser and discovering application",
      progress: 5, started_at: new Date().toISOString(),
    }).eq("id", runId);

    let browser: BrowserHandle;
    try {
      browser = await connectBrowser();
    } catch (browserErr) {
      const msg = browserErr instanceof Error ? browserErr.message : "Failed to connect to browser";
      await supabase.from("test_runs").update({
        status: "failed", error_message: msg, completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authCredentials = target.auth_required && target.auth_username && target.auth_password
      ? { username: target.auth_username, password: target.auth_password }
      : undefined;

    let pages: DiscoveredPage[] = [];
    try {
      pages = await discoverSite(
        browser, target.url, config.max_pages, config.crawl_depth,
        config.rate_limit_ms, config.timeout_ms, authCredentials,
      );
    } catch (discoverErr) {
      const msg = discoverErr instanceof Error ? discoverErr.message : "Discovery failed";
      await browser.close().catch(() => {});
      await supabase.from("test_runs").update({
        status: "failed", error_message: msg, completed_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ error: msg }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("test_runs").update({
      current_phase: "Storing discovered pages and features",
      progress: 40,
    }).eq("id", runId);

    // Store app_pages
    const pageRecords = pages.map((p) => ({
      run_id: runId, url: p.url, title: p.title, depth: p.depth,
      status: (p.error || p.statusCode >= 400) ? "failed" as const : "discovered" as const,
      status_code: p.statusCode, load_time_ms: p.loadTimeMs,
      console_errors: p.consoleErrors, network_errors: p.networkErrors,
    }));

    const { data: insertedPages, error: pagesError } = await supabase
      .from("app_pages").insert(pageRecords).select();

    if (pagesError) throw new Error("Failed to store discovered pages: " + pagesError.message);

    const pageIdMap = new Map<string, string>();
    if (insertedPages) {
      insertedPages.forEach((p, i) => pageIdMap.set(pages[i].url, p.id));
    }

    // Store features
    const featureRecords: Record<string, unknown>[] = [];
    for (const p of pages) {
      const pageId = pageIdMap.get(p.url);
      if (!pageId) continue;
      for (const f of p.features) {
        featureRecords.push({
          run_id: runId, page_id: pageId, type: f.type,
          selector: f.selector, label: f.label, attributes: f.attributes,
        });
      }
    }

    let totalFeatures = 0;
    if (featureRecords.length > 0) {
      const { error: featuresError } = await supabase.from("features").insert(featureRecords);
      if (featuresError) throw new Error("Failed to store discovered features: " + featuresError.message);
      totalFeatures = featureRecords.length;
    }

    // === TEST CASE GENERATION PHASE ===
    await supabase.from("test_runs").update({
      status: "generating",
      current_phase: "Generating test cases from discovered pages and features",
      progress: 60,
    }).eq("id", runId);

    const { cases: generatedCases, techniquesUsed } = await generateAllTestCases(
      runId, pages, pageIdMap, config.max_test_cases,
    );

    let insertedTestCaseCount = 0;
    if (generatedCases.length > 0) {
      const testCaseRecords = generatedCases.map((tc) => ({
        run_id: runId,
        page_id: tc.page_id || null,
        feature_id: tc.feature_id || null,
        case_id: tc.case_id,
        module_page: tc.module_page,
        scenario: tc.scenario,
        technique: tc.technique,
        preconditions: tc.preconditions,
        test_data: tc.test_data,
        steps: tc.steps,
        expected_result: tc.expected_result,
        status: "pending" as const,
      }));

      const { error: tcError } = await supabase.from("test_cases").insert(testCaseRecords);
      if (tcError) throw new Error("Failed to store test cases: " + tcError.message);
      insertedTestCaseCount = testCaseRecords.length;
    }

    // Mark features that have test cases as tested
    if (generatedCases.length > 0) {
      const testedFeatureIds = [...new Set(
        generatedCases.map((tc) => tc.feature_id).filter(Boolean) as string[]
      )];
      for (const fid of testedFeatureIds) {
        await supabase.from("features").update({ tested: true }).eq("id", fid);
      }
    }

    // === COVERAGE ===
    await supabase.from("test_runs").update({
      current_phase: "Calculating coverage",
      progress: 80,
    }).eq("id", runId);

    const featuresTested = generatedCases.length > 0
      ? new Set(generatedCases.map((tc) => tc.feature_id).filter(Boolean)).size
      : 0;
    const coveragePct = totalFeatures > 0
      ? Math.round((featuresTested / totalFeatures) * 100)
      : 0;

    const untestedAreas = pages
      .filter((p) => !p.error)
      .map((p) => ({
        url: p.url, title: p.title,
        reason: "Test cases generated — execution pending",
      }));

    await supabase.from("coverage").insert({
      run_id: runId,
      pages_discovered: pages.length, pages_tested: 0,
      features_discovered: totalFeatures, features_tested: featuresTested,
      workflows_discovered: 0, workflows_tested: 0,
      test_cases_generated: insertedTestCaseCount, test_cases_executed: 0,
      passed: 0, failed: 0, blocked: 0,
      coverage_percentage: coveragePct,
      untested_areas: untestedAreas,
      techniques_used: techniquesUsed,
    });

    // Surface discovery errors
    const discoveryErrors = pages.filter((p) => p.error).map((p) => `${p.url}: ${p.error}`);
    const runErrorMessage = discoveryErrors.length > 0
      ? `Discovery completed with errors on ${discoveryErrors.length} page(s): ${discoveryErrors.join("; ")}`
      : null;

    // Final update
    await supabase.from("test_runs").update({
      status: "completed",
      current_phase: "Discovery and test case generation completed — ready for execution",
      progress: 100,
      total_test_cases: insertedTestCaseCount,
      coverage_percentage: coveragePct,
      error_message: runErrorMessage,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);

    return new Response(JSON.stringify({
      success: true, runId,
      phase: "discovery_and_generation",
      summary: {
        pagesDiscovered: pages.length,
        featuresDiscovered: totalFeatures,
        testCasesGenerated: insertedTestCaseCount,
        techniquesUsed,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (runId) {
      await supabase.from("test_runs").update({
        status: "failed", error_message: errorMessage,
        completed_at: new Date().toISOString(),
      }).eq("id", runId).then(() => {}, () => {});
    }
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
