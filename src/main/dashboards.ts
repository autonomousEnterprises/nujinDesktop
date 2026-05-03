import { join } from "path";
import fs from "fs";
import { getHermesHome } from "./config";
import { BrowserWindow } from "electron";

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

export function getWidgetData(dashboardId: string, dataSource: string, profile?: string): any {
  const dir = getDashboardsDir(profile);
  const path = join(dir, dataSource);
  
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
