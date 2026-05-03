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

  // Always write INSTRUCTION.md so it stays up-to-date with the renderer
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
- \`variant\`: \`solid\`, \`glass\`, \`gradient\`, \`outline\`
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
      "variant": "gradient",
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
