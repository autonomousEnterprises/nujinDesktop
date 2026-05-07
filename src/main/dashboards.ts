import { join } from "path";
import fs from "fs";
import { getHermesHome } from "./config";
import { HERMES_PYTHON } from "./installer";
import { BrowserWindow } from "electron";
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
async function executeScript(scriptPath: string, cwd: string): Promise<any> {
  const env = { ...process.env, PYTHONIOENCODING: "utf-8" };

  const tryRun = async (interpreter: string) => {
    const { stdout } = await execFileAsync(interpreter, [scriptPath], {
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

export interface WidgetConfig {
  id: string;
  type: "metric" | "line_chart" | "bar_chart" | "area_chart" | "donut_chart" | "table" | "list" | "sparkline" | "progress";
  title: string;
  description?: string;
  dataSource: string; // Relative path from dashboards directory
  refreshInterval?: number; // in seconds
  config?: any; // Tremor specific config
  gridSize?: "small" | "medium" | "large" | "wide" | "tall" | "full";
  color?: string;
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
  const dataDir = join(nujinDir, "data");
  const instructionFile = join(nujinDir, "INSTRUCTION.md");

  // Create directories if they don't exist
  [nujinDir, dashboardsDir, scriptsDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Write INSTRUCTION.md as a convenience mirror for CLI / Hermes agent usage.
  // The authoritative source of truth is NUJIN_SYSTEM_PROMPT in DashboardChat.tsx.
  const instructionContent = `# Nujin Dashboard Protocol — v2

You are the **Nujin Dashboard Engineer**. Build bento-style dashboards backed by Python scripts. **DO NOT create Hermes plugins.**

## 📁 Directory Structure
- Dashboard JSON configs: \`~/.hermes/nujin/dashboards/<id>.json\`
- Backend Python scripts: \`~/.hermes/nujin/scripts/<name>.py\`
- Cached data (for cron): \`~/.hermes/nujin/data/<name>.json\`

## 🔌 Data Architecture (Two Modes)

### On-Demand (Default)
Script prints JSON to **stdout**. The app executes it when the dashboard is viewed.
- Set widget \`"dataSource": "scripts/<name>.py"\`

### Persistent Background (Cron)
Use when the user needs data tracked while the app is closed.
1. Script writes JSON to \`~/.hermes/nujin/data/<name>.json\`
2. Schedule: \`hermes cron create "*/5 * * * *" --name "Nujin <name>" -- "~/.hermes/hermes-agent/venv/bin/python ~/.hermes/nujin/scripts/<name>.py"\`
3. Set widget \`"dataSource": "data/<name>.json"\`

## 📊 Supported Widget Types (EXACT names)

| type          | Data shape expected                | Config fields                          |
|---------------|------------------------------------|----------------------------------------|
| \`metric\`      | \`{value, delta?, subtext?}\`        | \`valuePath\`, \`subtext\`, \`icon\`          |
| \`table\`       | \`{headers, rows}\`                  | \`rowsPath\`, \`columns\`                   |
| \`area_chart\`  | \`{series: [{date, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`line_chart\`  | \`{series: [{date, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`bar_chart\`   | \`{series: [{name, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`donut_chart\` | \`{series: [{name, value}]}\`        | \`seriesPath\`, \`index\`, \`category\`, \`colors\` |
| \`progress\`    | \`{value (0-100), subtext?}\`        | \`valuePath\`, \`subtext\`                  |

### ⚡ Critical Config Fields

- **\`valuePath\`**: Dot-notation path to extract a value from nested JSON. Example: if your script returns \`{"cpu": {"total_percent": 1.3}}\`, set \`"valuePath": "cpu.total_percent"\` and the widget will show \`1.3\`.
- **\`rowsPath\`**: Dot-notation path to an array of objects for table rows. Example: \`"rowsPath": "processes"\`.
- **\`seriesPath\`**: Dot-notation path to an array of data points for charts. Example: \`"seriesPath": "history"\`.
- **\`columns\`**: Array of column names for tables. Example: \`["pid", "name", "cpu_percent"]\`.

## 📏 Layout
- \`gridSize\`: \`small\`, \`medium\`, \`large\`, \`wide\`, \`tall\`, \`full\`
- \`color\`: \`blue\`, \`emerald\`, \`indigo\`, \`rose\`, \`amber\`, \`cyan\`, \`violet\`, \`orange\`

## 📋 Full Example

\`\`\`json
{
  "id": "system_monitor",
  "title": "System Monitor",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "cpu",
      "type": "metric",
      "title": "CPU Usage",
      "gridSize": "medium",
      "color": "blue",
      "dataSource": "scripts/sysmon.py",
      "refreshInterval": 10,
      "config": {
        "valuePath": "cpu.total_percent",
        "subtext": "Live CPU"
      }
    },
    {
      "id": "procs",
      "type": "table",
      "title": "Top Processes",
      "gridSize": "wide",
      "dataSource": "scripts/sysmon.py",
      "config": {
        "rowsPath": "processes",
        "columns": ["pid", "name", "cpu_percent", "rss_bytes"]
      }
    }
  ]
}
\`\`\`

**Always test your script with \`python3 <path>\` before saving the dashboard JSON.**
`;
  fs.writeFileSync(instructionFile, instructionContent, "utf-8");
}

export function listDashboards(profile?: string): string[] {
  const dir = getDashboardsDir(profile);
  if (!fs.existsSync(dir)) return [];
  
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json") && !f.startsWith("data_"))
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
    fs.unlinkSync(path);
    console.log(`[Dashboards] Deleted: ${id}`);
    return true;
  } catch (err) {
    console.error(`Error deleting dashboard ${id}:`, err);
    return false;
  }
}

export async function getWidgetData(dashboardId: string, dataSource: string, profile?: string): Promise<any> {
  const dir = getDashboardsDir(profile);
  const hermesHome = getHermesHome(profile);

  // ── Script-Driven Data (.py) ──────────────────────────────────────────────
  if (dataSource.endsWith(".py")) {
    const fullScriptPath = dataSource.startsWith("/")
      ? dataSource
      : join(hermesHome, "nujin", dataSource);

    if (!fs.existsSync(fullScriptPath)) return null;

    const cacheKey = fullScriptPath;

    // 1. Return cached result if still fresh
    const cached = scriptResultCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      console.log(`[WidgetData] Cache hit: ${fullScriptPath}`);
      return cached.data;
    }

    // 2. Attach to an already-running execution (deduplication)
    const inflight = inFlightScripts.get(cacheKey);
    if (inflight) {
      console.log(`[WidgetData] Joining in-flight: ${fullScriptPath}`);
      return inflight;
    }

    // 3. Start a fresh execution
    console.log(`[WidgetData] Executing: ${fullScriptPath}`);
    const scriptDir = join(hermesHome, "nujin");
    const promise = executeScript(fullScriptPath, scriptDir)
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

  // ── Static JSON Data ─────────────────────────────────────────────────────
  const jsonPath = join(dir, dataSource);
  if (!fs.existsSync(jsonPath)) return null;

  try {
    const content = fs.readFileSync(jsonPath, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`[WidgetData] Error reading static data ${dataSource}:`, err);
    return null;
  }
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
