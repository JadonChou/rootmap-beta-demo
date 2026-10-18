import "server-only";

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import type { VerificationStatus } from "@/lib/sandbox/runner";

export type BrowserRouteProbe = {
  path: string;
  /** When true, fill a safe form and submit without external delivery. */
  expectForm: boolean;
};

export type BrowserRouteResult = {
  path: string;
  ok: boolean;
  title?: string | null;
  statusCode?: number | null;
  consoleErrors: string[];
  pageErrors: string[];
  detail?: string;
  /** Small JPEG screenshot (base64), when captured. */
  screenshotBase64?: string | null;
};

export type BrowserFormResult = {
  route: string;
  ok: boolean;
  detail: string;
};

export type BrowserVerificationResult = {
  status: VerificationStatus;
  available: boolean;
  skipped?: boolean;
  skipReason?: string | null;
  summary: string;
  routes: BrowserRouteResult[];
  formTests: BrowserFormResult[];
  /** Safe fixture identity used for form fills. */
  testIdentity: {
    name: string;
    email: string;
    message: string;
  };
};

const SAFE_IDENTITY = {
  name: "Sigcue Browser Test",
  email: "browser-test@example.invalid",
  message: "Automated Sigcue verification — do not deliver or email.",
};

const BROWSER_TIMEOUT_MS = Number(
  process.env.ROOTMAP_BROWSER_VERIFY_TIMEOUT_MS ?? 180_000,
);

/** Infer App Router / Pages Router routes from proposed files (reusable). */
export function inferBrowserRoutes(
  files: { path: string; content: string }[],
): BrowserRouteProbe[] {
  const byPath = new Map<string, BrowserRouteProbe>();

  for (const file of files) {
    const appPage = file.path.match(
      /(?:^|\/)(?:src\/)?app\/(.*)\/page\.(tsx|jsx|ts|js)$/,
    );
    const appRoot = /(?:^|\/)(?:src\/)?app\/page\.(tsx|jsx|ts|js)$/.test(
      file.path,
    );
    const pagesFile = file.path.match(
      /(?:^|\/)pages\/(.+)\.(tsx|jsx|ts|js)$/,
    );

    let route: string | null = null;
    if (appRoot) route = "/";
    else if (appPage) {
      const seg = appPage[1]!.replace(/\\/g, "/");
      if (!seg.includes("[")) route = `/${seg}`;
    } else if (pagesFile) {
      const seg = pagesFile[1]!.replace(/\\/g, "/");
      if (seg === "index") route = "/";
      else if (!seg.startsWith("api/") && !seg.includes("[")) route = `/${seg}`;
    }

    if (!route) continue;
    const expectForm =
      /<form\b/i.test(file.content) ||
      (/useState/.test(file.content) &&
        /email/i.test(file.content) &&
        /message|textarea/i.test(file.content));
    const prev = byPath.get(route);
    byPath.set(route, {
      path: route,
      expectForm: Boolean(prev?.expectForm || expectForm),
    });
  }

  // Prefer feature routes over `/` when both exist.
  const routes = [...byPath.values()].sort((a, b) => {
    if (a.path === "/") return 1;
    if (b.path === "/") return -1;
    return a.path.localeCompare(b.path);
  });
  return routes.slice(0, 6);
}

function browserVerifyEnabled(): boolean {
  if (process.env.ROOTMAP_ENABLE_BROWSER_VERIFY === "false") return false;
  return true;
}

function stripSecretsEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    CI: "1",
  };
  // Explicitly do NOT copy tokens / DB URLs / AI keys.
  return env;
}

function run(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: stripSecretsEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      stdout += String(d).slice(0, 20_000);
    });
    child.stderr?.on("data", (d) => {
      stderr += String(d).slice(0, 20_000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(2_000),
      });
      if (res.status > 0) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function writeProposedFiles(
  root: string,
  files: { path: string; content: string }[],
) {
  for (const file of files.slice(0, 10)) {
    const safe = file.path.replace(/[^a-zA-Z0-9._/\\-]/g, "");
    if (!safe || safe.includes("..")) continue;
    const full = join(root, safe);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, file.content, "utf8");
  }
}

/**
 * Isolated browser verification for authorized write-target proposals.
 * Runs clone/install/start in a temp directory with a stripped env (no secrets).
 * Uses Playwright Chromium when available; otherwise returns UNVERIFIED.
 */
export async function runBrowserVerification(input: {
  repoFullName: string;
  branch?: string;
  files: { path: string; content: string }[];
  /** Override inferred routes (e.g. from agent). */
  routes?: BrowserRouteProbe[];
}): Promise<BrowserVerificationResult> {
  const testIdentity = { ...SAFE_IDENTITY };
  const probes =
    input.routes && input.routes.length > 0
      ? input.routes.slice(0, 6)
      : inferBrowserRoutes(input.files);

  if (!browserVerifyEnabled()) {
    return {
      status: "unverified",
      available: false,
      skipped: true,
      skipReason: "ROOTMAP_ENABLE_BROWSER_VERIFY=false",
      summary: "Browser verification incomplete — disabled by config",
      routes: [],
      formTests: [],
      testIdentity,
    };
  }

  if (probes.length === 0) {
    return {
      status: "unverified",
      available: false,
      skipped: true,
      skipReason: "No routable pages inferred from proposed files",
      summary:
        "Browser verification incomplete — no App Router/Pages routes to open",
      routes: [],
      formTests: [],
      testIdentity,
    };
  }

  let playwright: typeof import("playwright") | null = null;
  try {
    playwright = await import("playwright");
  } catch {
    return {
      status: "unverified",
      available: false,
      skipped: true,
      skipReason: "playwright package not installed",
      summary: "Browser verification incomplete — install playwright + chromium",
      routes: [],
      formTests: [],
      testIdentity,
    };
  }

  const work = mkdtempSync(join(tmpdir(), "sigcue-browser-verify-"));
  let server: ChildProcess | null = null;
  const port = 3100 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const clone = await run(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--branch",
        input.branch || "main",
        `https://github.com/${input.repoFullName}.git`,
        "repo",
      ],
      work,
      60_000,
    );
    if (clone.code !== 0) {
      return {
        status: "unverified",
        available: false,
        skipped: true,
        skipReason: `git clone failed: ${(clone.stderr || clone.stdout).slice(0, 240)}`,
        summary: "Browser verification incomplete — could not clone write-target",
        routes: [],
        formTests: [],
        testIdentity,
      };
    }

    const repoRoot = join(work, "repo");
    writeProposedFiles(repoRoot, input.files);

    const installCmd: [string, string[]] = existsSync(join(repoRoot, "package-lock.json"))
      ? ["npm", ["ci", "--no-audit", "--no-fund"]]
      : existsSync(join(repoRoot, "pnpm-lock.yaml"))
        ? ["pnpm", ["install", "--frozen-lockfile"]]
        : ["npm", ["install", "--no-audit", "--no-fund"]];

    const install = await run(
      installCmd[0],
      installCmd[1],
      repoRoot,
      120_000,
    );
    if (install.code !== 0) {
      return {
        status: "unverified",
        available: false,
        skipped: true,
        skipReason: `install failed: ${(install.stderr || install.stdout).slice(0, 240)}`,
        summary: "Browser verification incomplete — dependency install failed",
        routes: [],
        formTests: [],
        testIdentity,
      };
    }

    const build = await run(
      "npx",
      ["next", "build"],
      repoRoot,
      180_000,
    );
    if (build.code !== 0) {
      return {
        status: "failed",
        available: true,
        skipped: false,
        skipReason: null,
        summary: `Browser verification failed — next build exited ${build.code}`,
        routes: [
          {
            path: probes[0]!.path,
            ok: false,
            consoleErrors: [],
            pageErrors: [
              (build.stderr || build.stdout).slice(0, 500) || "build failed",
            ],
            detail: "Application failed to build before browser open",
          },
        ],
        formTests: [],
        testIdentity,
      };
    }

    server = spawn(
      "npx",
      ["next", "start", "-H", "127.0.0.1", "-p", String(port)],
      {
        cwd: repoRoot,
        env: stripSecretsEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      },
    );

    const ready = await waitForHttp(baseUrl, 60_000);
    if (!ready) {
      return {
        status: "unverified",
        available: false,
        skipped: true,
        skipReason: `App did not become ready on ${baseUrl}`,
        summary: "Browser verification incomplete — server did not start",
        routes: [],
        formTests: [],
        testIdentity,
      };
    }

    let browser;
    try {
      browser = await playwright.chromium.launch({ headless: true });
    } catch (error) {
      return {
        status: "unverified",
        available: false,
        skipped: true,
        skipReason:
          error instanceof Error
            ? error.message
            : "Chromium launch failed — run: pnpm exec playwright install chromium",
        summary: "Browser verification incomplete — Chromium unavailable",
        routes: [],
        formTests: [],
        testIdentity,
      };
    }

    const routeResults: BrowserRouteResult[] = [];
    const formTests: BrowserFormResult[] = [];

    try {
      for (const probe of probes) {
        const page = await browser.newPage();
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            consoleErrors.push(msg.text().slice(0, 300));
          }
        });
        page.on("pageerror", (err) => {
          pageErrors.push(String(err.message || err).slice(0, 300));
        });

        const url = `${baseUrl}${probe.path}`;
        let statusCode: number | null = null;
        let title: string | null = null;
        let screenshotBase64: string | null = null;
        let ok = true;
        let detail = "Rendered";

        try {
          const response = await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
          });
          statusCode = response?.status() ?? null;
          title = await page.title().catch(() => null);
          if (!statusCode || statusCode >= 400) {
            ok = false;
            detail = `HTTP ${statusCode ?? "none"}`;
          }
          // Allow hydration; then check for Next error overlay text.
          await new Promise((r) => setTimeout(r, 400));
          const bodyText = await page.locator("body").innerText().catch(() => "");
          if (/Application error|Unhandled Runtime Error|Hydration failed/i.test(bodyText)) {
            ok = false;
            detail = "Runtime error overlay detected";
          }
          if (pageErrors.length > 0) {
            ok = false;
            detail = `Page error: ${pageErrors[0]}`;
          }

          const shot = await page.screenshot({
            type: "jpeg",
            quality: 52,
            fullPage: false,
          });
          screenshotBase64 = shot.toString("base64").slice(0, 120_000);

          if (probe.expectForm && ok) {
            const form = page.locator("form").first();
            const formCount = await form.count();
            if (formCount === 0) {
              formTests.push({
                route: probe.path,
                ok: false,
                detail: "Expected a form but none was found",
              });
              ok = false;
              detail = "Missing form";
            } else {
              // Semantic selectors first; fall back to field order for controlled inputs
              // that omit name=/type= (common in generated demos).
              const textInputs = form.locator(
                'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])',
              );
              const namedName = form.locator(
                'input[name="name"], input[autocomplete="name"], input[placeholder*="name" i]',
              );
              const namedEmail = form.locator(
                'input[type="email"], input[name="email"], input[autocomplete="email"], input[placeholder*="email" i]',
              );
              const namedMessage = form.locator(
                'textarea[name="message"], textarea, input[name="message"]',
              );

              if ((await namedName.count()) > 0) {
                await namedName.first().fill(testIdentity.name);
              } else if ((await textInputs.count()) >= 1) {
                await textInputs.nth(0).fill(testIdentity.name);
              }
              if ((await namedEmail.count()) > 0) {
                await namedEmail.first().fill(testIdentity.email);
              } else if ((await textInputs.count()) >= 2) {
                await textInputs.nth(1).fill(testIdentity.email);
              }
              if ((await namedMessage.count()) > 0) {
                await namedMessage.first().fill(testIdentity.message);
              }

              let formOk = true;
              let formDetail = "Form submitted; response accepted locally";
              let attemptedExternal = false;
              page.on("request", (req) => {
                const u = req.url();
                if (
                  u.startsWith("mailto:") ||
                  /api\.mail|sendgrid|mailgun|postmark/i.test(u)
                ) {
                  attemptedExternal = true;
                }
              });

              const submit = form.locator(
                'button[type="submit"], input[type="submit"], button:has-text("Send"), button:has-text("Submit")',
              ).first();

              const responsePromise = page
                .waitForResponse(
                  (r) =>
                    r.request().method() === "POST" &&
                    (r.url().startsWith(baseUrl) || r.url().includes("/api/")),
                  { timeout: 15_000 },
                )
                .catch(() => null);

              if ((await submit.count()) > 0) {
                await submit.click();
              } else {
                await form.evaluate((el) =>
                  (el as HTMLFormElement).requestSubmit(),
                );
              }

              const response = await responsePromise;
              await page
                .waitForFunction(() => {
                  const t = document.body?.innerText || "";
                  return /thank you|message sent|success|received|please enter|invalid email|missing|failed|error/i.test(
                    t,
                  );
                }, { timeout: 8_000 })
                .catch(() => null);

              const afterText = await page
                .locator("body")
                .innerText()
                .catch(() => "");

              if (attemptedExternal) {
                formOk = false;
                formDetail = "Blocked: attempted real email delivery";
              } else if (response) {
                const status = response.status();
                if (status >= 400) {
                  formOk = false;
                  formDetail = `Form POST returned HTTP ${status}`;
                } else {
                  formDetail = `Form POST HTTP ${status} (local handler; .invalid address)`;
                }
              } else if (/thank you|message sent|success|received/i.test(afterText)) {
                formDetail = "UI success state after submit (no external mail)";
              } else if (
                /please enter|invalid email|missing name|missing message|failed/i.test(
                  afterText,
                )
              ) {
                formOk = false;
                formDetail = "UI shows a validation/error state after submit";
              } else {
                formOk = false;
                formDetail =
                  "No local POST response or success state — form behavior unclear";
              }

              formTests.push({
                route: probe.path,
                ok: formOk,
                detail: formDetail,
              });
              if (!formOk) {
                ok = false;
                detail = formDetail;
              }
            }
          }
        } catch (error) {
          ok = false;
          detail =
            error instanceof Error ? error.message.slice(0, 240) : "Navigation failed";
        } finally {
          await page.close().catch(() => undefined);
        }

        routeResults.push({
          path: probe.path,
          ok,
          title,
          statusCode,
          consoleErrors: consoleErrors.slice(0, 8),
          pageErrors: pageErrors.slice(0, 8),
          detail,
          screenshotBase64,
        });
      }
    } finally {
      await browser.close().catch(() => undefined);
    }

    const routesFailed = routeResults.some((r) => !r.ok);
    const formsFailed = formTests.some((f) => !f.ok);
    const status: VerificationStatus =
      routesFailed || formsFailed ? "failed" : "passed";

    return {
      status,
      available: true,
      skipped: false,
      skipReason: null,
      summary:
        status === "passed"
          ? `Browser verification passed (${routeResults.length} route(s)${
              formTests.length ? `, ${formTests.length} form test(s)` : ""
            })`
          : `Browser verification failed — check route/form results`,
      routes: routeResults,
      formTests,
      testIdentity,
    };
  } catch (error) {
    return {
      status: "unverified",
      available: false,
      skipped: true,
      skipReason:
        error instanceof Error ? error.message : "Browser verification crashed",
      summary: "Browser verification incomplete — unexpected error",
      routes: [],
      formTests: [],
      testIdentity,
    };
  } finally {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      setTimeout(() => {
        try {
          server?.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 2000);
    }
    try {
      rmSync(work, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function formatBrowserVerificationForUser(
  browser: BrowserVerificationResult,
): string {
  if (browser.skipped || browser.status === "unverified") {
    return [
      "BROWSER UNVERIFIED — functional browser checks did not complete.",
      browser.skipReason ? `Reason: ${browser.skipReason}` : null,
      browser.summary,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const lines = [
    browser.status === "passed"
      ? "BROWSER VERIFIED — pages rendered in isolated Playwright run."
      : "BROWSER FAILED — functional checks found problems.",
    browser.summary,
    ...browser.routes.map(
      (r) =>
        `- ${r.path}: ${r.ok ? "ok" : "FAIL"} (HTTP ${r.statusCode ?? "?"}) ${r.detail ?? ""}`,
    ),
    ...browser.formTests.map(
      (f) => `- form ${f.route}: ${f.ok ? "ok" : "FAIL"} — ${f.detail}`,
    ),
    `Safe test identity: ${browser.testIdentity.email}`,
  ];
  return lines.join("\n");
}
