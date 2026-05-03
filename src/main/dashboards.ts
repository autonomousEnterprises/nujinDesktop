import { join } from "path";
import fs from "fs";
import { getHermesHome } from "./config";
import { HERMES_PYTHON } from "./installer";
import { BrowserWindow } from "electron";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface WidgetConfig {
  id: string;
  type: "metric" | "line_chart" | "bar_chart" | "area_chart" | "donut_chart" | "table" | "list" | "sparkline" | "progress";
  title: string;
  description?: string;
  dataSource: string; // Relative path from dashboards directory
  refreshInterval?: number; // in seconds
  config?: any; // Tremor specific config
  gridSize?: "small" | "medium" | "large" | "wide" | "tall" | "full";
  variant?: "solid" | "glass" | "gradient" | "outline";
  color?: string;
}

export interface DashboardConfig {
  id: string;
  title: string;
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

  // Create INSTRUCTION.md if it doesn't exist
  if (!fs.existsSync(instructionFile)) {
    const instructionContent = `# AI Dashboard Protocol (Nujin)

You are the **Nujin Dashboard Engineer**. Your job is to build and maintain high-density, bento-style dashboards with autonomous, persistent backends.

## 📁 Directory Structure
- Dashboard Configurations: \`~/.hermes/nujin/dashboards/*.json\`
- Backend Scripts: \`~/.hermes/nujin/scripts/*.py\`
- Cache/Data Storage: \`~/.hermes/nujin/data/*.json\` (Optional, scripts can also output directly)

## 🏗️ Architecture: Script-Driven Backends
Every widget must be powered by a **Backend Script**.
1. **The Script**: Create a Python script in \`scripts/\` that fetches data (via API, scraping, or system calls) and prints a valid JSON object to \`stdout\`.
2. **The Widget**: In the dashboard JSON, set \`dataSource\` to the name of your script (e.g., \`"dataSource": "scripts/my_widget.py"\`).
3. **Persistence**: You **MUST** ensure data stays fresh by scheduling the script via the \`hermes-agent\` cron system.
   - Use \`hermes cron create "*/5 * * * *" --name "Update My Widget" -- "python3 ~/.hermes/nujin/scripts/my_widget.py > ~/.hermes/nujin/data/my_widget.json"\`
   - If you use the cron-to-file method, the widget \`dataSource\` can point to the JSON file, but the **logic** must live in the script.
   - Alternatively, the dashboard engine can execute the script directly on refresh.

## 📏 Layout Guidelines (Bento Grid)
- Use \`gridSize\`: \`small\`, \`medium\`, \`large\`, \`wide\`, \`tall\`, \`full\`.
- Use professional colors: \`blue\`, \`emerald\`, \`indigo\`, \`rose\`, \`amber\`, \`cyan\`.
- Keep widgets dense and data-rich.

## 🛠️ Tools at your disposal
- Use \`write_file\` to create/edit JSON configs and Python scripts.
- Use \`run_shell_command\` to test scripts and manage \`hermes cron\` jobs.
- Use \`hermes cron list\` to verify background tasks.

**Always ensure the backend script is robust and handles errors gracefully by returning a valid JSON object even on failure.**
`;
    fs.writeFileSync(instructionFile, instructionContent, "utf-8");
  }
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

export async function getWidgetData(dashboardId: string, dataSource: string, profile?: string): Promise<any> {
  const dir = getDashboardsDir(profile);
  const path = join(dir, dataSource);
  const hermesHome = getHermesHome(profile);
  
  // Handle Script-Driven Data (e.g. .py scripts)
  if (dataSource.endsWith(".py")) {
    const fullScriptPath = dataSource.startsWith("/") ? dataSource : join(hermesHome, "nujin", dataSource);
    if (!fs.existsSync(fullScriptPath)) return null;

    try {
      // Execute Python script from the Hermes environment
      const { stdout } = await execFileAsync(HERMES_PYTHON, [fullScriptPath], {
        timeout: 10000,
        env: { ...process.env, PYTHONIOENCODING: "utf-8" }
      });
      return JSON.parse(stdout);
    } catch (err) {
      console.error(`Error executing widget script ${dataSource}:`, err);
      return { error: "Script execution failed", details: err.message };
    }
  }

  // Handle Static JSON Data
  if (!fs.existsSync(path)) return null;
  
  try {
    const content = fs.readFileSync(path, "utf-8");
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading widget data ${dataSource}:`, err);
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
