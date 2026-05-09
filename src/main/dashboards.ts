import { join } from "path";
import fs from "fs";
import { getHermesHome } from "./config";
import { HERMES_PYTHON } from "./installer";
import { BrowserWindow, app } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─── Script Execution Cache & Deduplication ─────────────────────────────────
// Prevents N widgets pointing at the same script from spawning N Python
// processes concurrently (which causes rate-limit failures, timeouts, and
// the "some widgets work / some don't" symptom).
//
// - inFlightScripts: if a script is already running, attach to that promise
// - scriptResultCache: reuse the last result for CACHE_TTL_MS after a run

const CACHE_TTL_MS = 15_000; // 15 seconds

interface CacheEntry {
  data: any;
  timestamp: number;
}

const scriptResultCache = new Map<string, CacheEntry>();
const inFlightScripts = new Map<string, Promise<any>>();

/** Invalidate a specific cache entry (e.g., on manual Refresh). */
export function invalidateWidgetCache(scriptPath: string): void {
  scriptResultCache.delete(scriptPath);
}

/** Wipe the entire cache (used when switching dashboards / profiles). */
export function clearWidgetCache(): void {
  scriptResultCache.clear();
  // Note: in-flight promises finish naturally; we just won't cache their result.
}

/**
 * Resolve the best available Python interpreter for running dashboard scripts.
 * Priority: Hermes venv → system python3 → python
 * Returns the resolved interpreter path/name.
 */
async function resolvePythonInterpreter(): Promise<string> {
  if (fs.existsSync(HERMES_PYTHON)) return HERMES_PYTHON;
  // Hermes venv not present - fall back to system python
  return "python3";
}

/**
 * Execute a Python script and return its parsed JSON stdout.
 * Tries the Hermes venv first; on ModuleNotFoundError retries with system python3.
 */
async function executeScript(scriptPathWithArgs: string, cwd: string): Promise<any> {
  const env = { ...process.env, PYTHONIOENCODING: "utf-8" };

  const parts = scriptPathWithArgs.trim().match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
  const scriptPath = parts[0]?.replace(/^"|"$/g, '');
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, ''));

  const tryRun = async (interpreter: string) => {
    const { stdout } = await execFileAsync(interpreter, [scriptPath, ...args], {
      timeout: 60_000,
      env,
      cwd,
    });
    return JSON.parse(stdout);
  };

  const primaryInterpreter = await resolvePythonInterpreter();

  try {
    return await tryRun(primaryInterpreter);
  } catch (err: any) {
    const stderr: string = err.stderr?.toString?.() || "";
    const isModuleError = stderr.includes("ModuleNotFoundError") || stderr.includes("No module named");

    // If the Hermes venv is missing a package, retry with system python3
    if (isModuleError && primaryInterpreter === HERMES_PYTHON) {
      console.warn(`[WidgetData] Hermes venv missing module, retrying with system python3: ${scriptPath}`);
      try {
        return await tryRun("python3");
      } catch (fallbackErr: any) {
        const fbStderr = fallbackErr.stderr?.toString?.() || "";
        const fbStdout = fallbackErr.stdout?.toString?.() || "";
        const detail = fbStderr.trim() || fallbackErr.message || "Unknown error";
        console.error(`[WidgetData] Fallback also failed: ${scriptPath}\n  stderr: ${fbStderr}\n  stdout: ${fbStdout.slice(0, 200)}`);
        return { error: "Script execution failed", details: detail.slice(0, 300) };
      }
    }

    // Other errors (syntax error, network issue, JSON parse, etc.)
    const stdout = err.stdout?.toString?.() || "";
    const code = err.code ?? err.status ?? "?";
    console.error(`[WidgetData] Script failed: ${scriptPath}\n  exit=${code} signal=${err.signal}\n  stderr: ${stderr}\n  stdout: ${stdout.slice(0, 200)}`);
    const detail = stderr.trim() || err.message || "Unknown error";
    return { error: "Script execution failed", details: detail.slice(0, 300) };
  }
}

export interface ActionConfig {
  id: string;
  label: string;
  scriptPath: string; // Relative path from scripts directory
  icon?: string;
  color?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
}

export interface WidgetConfig {
  id: string;
  type: "metric" | "line_chart" | "bar_chart" | "area_chart" | "donut_chart" | "table" | "list" | "sparkline" | "progress" | "button_group" | "action";
  title: string;
  description?: string;
  dataSource?: string; // Optional for action-only widgets
  refreshInterval?: number; // in seconds
  config?: any; // Tremor specific config
  gridSize?: "small" | "medium" | "large" | "wide" | "tall" | "full";
  color?: string;
  actions?: ActionConfig[];
}

export interface DashboardConfig {
  id: string;
  title: string;
  sessionId?: string;
  widgets: WidgetConfig[];
  layout?: any;
}

const getDashboardsDir = (profile?: string): string => {
  return join(getHermesHome(profile), "nujin", "dashboards");
};

export function initNujinWorkspace(profile?: string): void {
  const hermesHome = getHermesHome(profile);
  const nujinDir = join(hermesHome, "nujin");
  const dashboardsDir = join(nujinDir, "dashboards");
  const scriptsDir = join(nujinDir, "scripts");
  const stateDir = join(nujinDir, "state");
  const oldDataDir = join(nujinDir, "data");
  const instructionFile = join(nujinDir, "INSTRUCTION.md");

  // Migration: Rename data to state if it exists
  if (fs.existsSync(oldDataDir) && !fs.existsSync(stateDir)) {
    try {
      fs.renameSync(oldDataDir, stateDir);
      console.log(`[Dashboards] Migrated 'data' directory to 'state'`);
    } catch (e) {
      console.error(`[Dashboards] Failed to migrate 'data' to 'state':`, e);
    }
  }

  // Create directories if they don't exist
  [nujinDir, dashboardsDir, scriptsDir, stateDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Copy built-in skills to ~/.hermes/skills/
  const builtInSkillsDir = join(app.getAppPath(), "skills");
  const hermesSkillsDir = join(hermesHome, "skills");
  
  if (fs.existsSync(builtInSkillsDir)) {
    try {
      if (!fs.existsSync(hermesSkillsDir)) {
        fs.mkdirSync(hermesSkillsDir, { recursive: true });
      }
      fs.cpSync(builtInSkillsDir, hermesSkillsDir, { recursive: true });
      console.log(`[Dashboards] Copied built-in skills from ${builtInSkillsDir} to ${hermesSkillsDir}`);
    } catch (e) {
      console.error(`[Dashboards] Failed to copy built-in skills:`, e);
    }
  }
}

export function listDashboards(profile?: string): string[] {
  const dir = getDashboardsDir(profile);
  if (!fs.existsSync(dir)) return [];
  
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json") && !f.startsWith("state_"))
    .map(f => f.replace(".json", ""));
}

export function getDashboard(id: string, profile?: string): DashboardConfig | null {
  const dir = getDashboardsDir(profile);
  const path = join(dir, `${id}.json`);
  
  if (!fs.existsSync(path)) return null;
  
  try {
    const content = fs.readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading dashboard ${id}:`, err);
    return null;
  }
}

export function saveDashboard(id: string, config: DashboardConfig, profile?: string): boolean {
  const dir = getDashboardsDir(profile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const path = join(dir, `${id}.json`);
  try {
    fs.writeFileSync(path, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error(`Error saving dashboard ${id}:`, err);
    return false;
  }
}

export function deleteDashboard(id: string, profile?: string): boolean {
  const dir = getDashboardsDir(profile);
  const path = join(dir, `${id}.json`);
  console.log(`[Dashboards] Attempting to delete: ${path}`);
  
  if (!fs.existsSync(path)) {
    console.warn(`[Dashboards] File not found: ${path}`);
    return false;
  }
  
  try {
    // 1. Read the dashboard config to find associated scripts/state files
    const content = fs.readFileSync(path, "utf-8");
    const config: DashboardConfig = JSON.parse(content);
    
    const getBaseAssetPath = (path: string) => path.trim().split(/\s+/)[0];

    const assetsToRemove = new Set<string>();
    if (config.widgets) {
      config.widgets.forEach(w => {
        // Collect widget data source
        if (w.dataSource && (w.dataSource.startsWith("scripts/") || w.dataSource.startsWith("state/"))) {
          assetsToRemove.add(getBaseAssetPath(w.dataSource));
        }
        // Collect widget actions
        if (w.actions) {
          w.actions.forEach(a => {
            if (a.scriptPath && (a.scriptPath.startsWith("scripts/") || a.scriptPath.startsWith("state/"))) {
              assetsToRemove.add(getBaseAssetPath(a.scriptPath));
            }
          });
        }
      });
    }

    // 2. Identify assets used by ALL OTHER dashboards to avoid deleting shared scripts
    const allDashboards = listDashboards(profile);
    const sharedAssets = new Set<string>();
    
    allDashboards.forEach(otherId => {
      if (otherId === id) return;
      const otherConfig = getDashboard(otherId, profile);
      if (otherConfig && otherConfig.widgets) {
        otherConfig.widgets.forEach(w => {
          if (w.dataSource && (w.dataSource.startsWith("scripts/") || w.dataSource.startsWith("state/"))) {
            sharedAssets.add(getBaseAssetPath(w.dataSource));
          }
          if (w.actions) {
            w.actions.forEach(a => {
              if (a.scriptPath && (a.scriptPath.startsWith("scripts/") || a.scriptPath.startsWith("state/"))) {
                sharedAssets.add(getBaseAssetPath(a.scriptPath));
              }
            });
          }
        });
      }
    });

    // 3. Delete orphaned scripts and state files
    const hermesHome = getHermesHome(profile);
    assetsToRemove.forEach(relPath => {
      if (!sharedAssets.has(relPath)) {
        const fullPath = join(hermesHome, "nujin", relPath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            console.log(`[Dashboards] Cleaned up orphaned asset: ${relPath}`);
          } catch (e) {
            console.error(`[Dashboards] Failed to delete orphaned asset ${relPath}:`, e);
          }
        }
      }
    });

    // 4. Finally delete the dashboard JSON itself
    fs.unlinkSync(path);
    console.log(`[Dashboards] Deleted dashboard: ${id}`);
    return true;
  } catch (err) {
    console.error(`Error deleting dashboard ${id}:`, err);
    return false;
  }
}

export async function getWidgetData(dashboardId: string, dataSource: string, profile?: string): Promise<any> {
  console.log(`[Dashboards] getWidgetData: ${dataSource}`);
  const dir = getDashboardsDir(profile);
  const hermesHome = getHermesHome(profile);

  // ── Script-Driven Data (.py) ──────────────────────────────────────────────
  if (dataSource.includes(".py")) {
    const parts = dataSource.trim().split(/\s+/);
    const relPath = parts[0];
    
    const fullScriptPath = relPath.startsWith("/")
      ? relPath
      : join(hermesHome, "nujin", relPath);

    if (!fs.existsSync(fullScriptPath)) return null;

    // The cache key should include the full dataSource string (including args)
    // so that "counter.py get" and "counter.py status" are cached separately.
    const cacheKey = dataSource;

    // 1. Return cached result if still fresh
    const cached = scriptResultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[WidgetData] Cache hit: ${cacheKey}`);
      return cached.data;
    }

    // 2. Attach to an already-running execution (deduplication)
    const inflight = inFlightScripts.get(cacheKey);
    if (inflight) {
      console.log(`[WidgetData] Joining in-flight: ${cacheKey}`);
      return inflight;
    }

    // 3. Start a fresh execution
    // Pass the full dataSource string so executeScript can parse out the arguments
    const execPath = relPath.startsWith("/") 
      ? dataSource 
      : join(hermesHome, "nujin", dataSource);

    console.log(`[WidgetData] Executing: ${execPath}`);
    const scriptDir = join(hermesHome, "nujin");
    const promise = executeScript(execPath, scriptDir)
      .then((result) => {
        // Only cache successful results (not error objects)
        if (!result?.error) {
          scriptResultCache.set(cacheKey, { data: result, timestamp: Date.now() });
        }
        inFlightScripts.delete(cacheKey);
        return result;
      })
      .catch((err) => {
        inFlightScripts.delete(cacheKey);
        throw err;
      });

    inFlightScripts.set(cacheKey, promise);
    return promise;
  }

  // ── Per-Dashboard State Key ──────────────────────────────────────────────
  // Convention: dataSource = "state/<key>" (no .json extension)
  // All state for a dashboard lives in one file: state/<dashboardId>.json
  if (dataSource.startsWith("state/") && !dataSource.endsWith(".json") && !dataSource.includes(".py")) {
    const stateKey = dataSource.slice("state/".length);
    const stateFile = join(hermesHome, "nujin", "state", `${dashboardId}.json`);
    if (!fs.existsSync(stateFile)) return { [stateKey]: "" };
    try {
      const content = fs.readFileSync(stateFile, "utf-8");
      const all = JSON.parse(content);
      return { [stateKey]: all[stateKey] ?? "" };
    } catch {
      return { [stateKey]: "" };
    }
  }

  // ── Legacy Static JSON State (.json extension) ────────────────────────────
  const jsonPath = dataSource.startsWith("/") 
    ? dataSource 
    : join(hermesHome, "nujin", dataSource);
    
  if (!fs.existsSync(jsonPath)) return null;

  try {
    const content = fs.readFileSync(jsonPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`[WidgetData] Error reading static state ${dataSource}:`, err);
    return null;
  }
}

/**
 * Execute a dashboard action script.
 * Supports arguments in the scriptPath (e.g. "scripts/counter.py inc").
 * Actions don't necessarily return data for a widget, but we return the stdout/stderr
 * so the UI can show feedback (e.g., in a toast).
 */
export async function executeDashboardAction(scriptPath: string, profile?: string, inputValue?: string, dashboardId?: string): Promise<any> {
  const hermesHome = getHermesHome(profile);

  // Parse the script path + any static args (e.g. "scripts/save_input.py system_alias")
  // We parse respecting quotes so static args can contain spaces.
  const parts = scriptPath.trim().match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
  const relPath = parts[0]?.replace(/^"|"$/g, '');
  const staticArgs = parts.slice(1).map(a => a.replace(/^"|"$/g, ''));

  const absoluteScriptPath = relPath.startsWith("/")
    ? relPath
    : join(hermesHome, "nujin", relPath);

  if (!fs.existsSync(absoluteScriptPath)) {
    return { error: "File not found", details: `Script does not exist at ${absoluteScriptPath}` };
  }

  // Build the final arg list. If an inputValue is provided, append it directly
  // as a real argument — no string interpolation, no escaping needed.
  const allArgs = inputValue !== undefined
    ? [...staticArgs, inputValue]
    : staticArgs;

  console.log(`[Dashboards] Executing Action: ${absoluteScriptPath}`, allArgs);
  const scriptDir = join(hermesHome, "nujin");
  const env = { 
    ...process.env, 
    PYTHONIOENCODING: "utf-8",
    ...(dashboardId ? { NUJIN_DASHBOARD_ID: dashboardId } : {}),
  };

  const tryRun = async (interpreter: string) => {
    const { stdout } = await execFileAsync(interpreter, [absoluteScriptPath, ...allArgs], {
      timeout: 60_000,
      env,
      cwd: scriptDir,
    });
    return JSON.parse(stdout);
  };

  let result: any;
  const primaryInterpreter = await resolvePythonInterpreter();
  try {
    result = await tryRun(primaryInterpreter);
  } catch (err: any) {
    const stderr: string = err.stderr?.toString?.() || "";
    const isModuleError = stderr.includes("ModuleNotFoundError") || stderr.includes("No module named");
    if (isModuleError && primaryInterpreter === HERMES_PYTHON) {
      try {
        result = await tryRun("python3");
      } catch (fbErr: any) {
        const detail = fbErr.stderr?.toString?.().trim() || fbErr.message || "Unknown error";
        return { error: "Script execution failed", details: detail.slice(0, 300) };
      }
    } else {
      const detail = stderr.trim() || err.message || "Unknown error";
      return { error: "Script execution failed", details: detail.slice(0, 300) };
    }
  }

  // Invalidate cache for this script so the next fetch is fresh
  if (!result?.error) {
    for (const key of scriptResultCache.keys()) {
      if (key.startsWith(relPath)) scriptResultCache.delete(key);
    }
    for (const key of inFlightScripts.keys()) {
      if (key.startsWith(relPath)) inFlightScripts.delete(key);
    }
  }

  return result;
}

let watcher: fs.FSWatcher | null = null;

export function watchDashboards(mainWindow: BrowserWindow, profile?: string): void {
  const dir = getDashboardsDir(profile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (watcher) {
    watcher.close();
  }

  watcher = fs.watch(dir, (eventType, filename) => {
    if (filename) {
      mainWindow.webContents.send("dashboard-updated", filename);
    }
  });
}
