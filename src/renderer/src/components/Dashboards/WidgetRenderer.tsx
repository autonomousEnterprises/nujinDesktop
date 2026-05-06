import { useState, useEffect } from "react";
import {
  Metric,
  Text,
  Title,
  Subtitle,
  LineChart,
  BarChart,
  AreaChart,
  DonutChart,
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  BadgeDelta,
  Badge,
  Flex,
  ProgressBar,
  ProgressCircle,
} from "@tremor/react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Users,
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  PieChart,
  Table as TableIcon,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from "lucide-react";
import { WidgetConfig } from "../../../../main/dashboards";
import { formatValue, formatCellValue } from "./formatUtils";

interface WidgetRendererProps {
  widget: WidgetConfig;
  dashboardId: string;
  profile: string;
  onDataFetched?: (data: any) => void;
}

const ICON_MAP: Record<string, any> = {
  trending: TrendingUp,
  down: TrendingDown,
  activity: Activity,
  money: DollarSign,
  users: Users,
  cart: ShoppingCart,
  clock: Clock,
  success: CheckCircle2,
  error: AlertCircle,
  chart: BarChart3,
  donut: PieChart,
  table: TableIcon,
};

const NEON_COLORS = ["cyan", "violet", "fuchsia", "blue", "emerald", "amber", "rose"];

const renderTableCell = (header: string, value: any, widgetConfig?: any) => {
  if (value === undefined || value === null) return "—";

  const h = header.toLowerCase();
  if (h === "status" || h === "category") {
    const color = (value.toLowerCase() === "active" || value.toLowerCase() === "vip" || value.toLowerCase() === "liquid staking") ? "emerald" :
      (value.toLowerCase() === "new" || value.toLowerCase() === "bridge") ? "blue" :
        (value.toLowerCase() === "lending") ? "violet" : "slate";
    return (
      <Badge color={color} size="xs" className="rounded-full px-2 py-0.5 font-bold uppercase text-[9px]">
        {value}
      </Badge>
    );
  }

  if (typeof value === "number") {
    return formatCellValue(header, value, widgetConfig);
  }

  return value;
};

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function transformData(raw: any, widget: WidgetConfig): any {
  if (!raw || raw.error) return raw;

  const cfg = widget.config || {};
  const wType = (widget.type || "").toLowerCase().trim();

  if (wType === "metric" || wType === "progress" || wType === "gauge" || wType === "sparkline") {
    const vPath = cfg.valuePath || cfg.value_path;
    if (vPath && raw.value === undefined) {
      const resolved = getNestedValue(raw, vPath);
      return {
        value: resolved !== undefined ? resolved : raw.value,
        delta: raw.delta || cfg.delta,
        deltaType: raw.deltaType || cfg.deltaType,
        subtext: raw.subtext || cfg.subtext,
      };
    }
    return raw;
  }

  if (wType === "table" || wType === "data_table") {
    const rPath = cfg.rowsPath || cfg.rows_path;
    if (rPath && !raw.rows) {
      const rows = getNestedValue(raw, rPath);
      return {
        headers: cfg.columns || (Array.isArray(rows) && rows.length > 0 ? Object.keys(rows[0]) : []),
        rows: Array.isArray(rows) ? rows : [],
      };
    }
    return raw;
  }

  if (["area_chart", "line_chart", "bar_chart", "chart", "donut_chart", "donut"].includes(wType)) {
    const sPath = cfg.seriesPath || cfg.series_path;
    let series = [];
    
    if (sPath) {
      series = getNestedValue(raw, sPath) || [];
    } else if (Array.isArray(raw)) {
      series = raw;
    } else if (raw.series) {
      series = raw.series;
    } else {
      // Heuristic: search for the first key that contains an array of objects
      const likelyKey = Object.keys(raw).find(k => Array.isArray(raw[k]) && raw[k].length > 0 && typeof raw[k][0] === "object");
      if (likelyKey) {
        series = raw[likelyKey];
      }
    }

    // Clean data: Ensure numeric values for potential categories
    if (Array.isArray(series)) {
      const cleanedSeries = series.map((item: any) => {
        const cleaned: any = { ...item };
        Object.keys(item).forEach(key => {
          if (typeof item[key] === "string" && !isNaN(parseFloat(item[key])) && !["date", "timestamp", "time"].includes(key.toLowerCase())) {
            cleaned[key] = parseFloat(item[key]);
          }
        });
        return cleaned;
      });
      return { series: cleanedSeries };
    }
    
    return raw;
  }

  return raw;
}

export default function WidgetRenderer({ widget, dashboardId, profile, onDataFetched }: WidgetRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "",
    direction: null,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await window.hermesAPI.dashboards.getWidgetData(dashboardId, widget.dataSource, profile);
      if (result) {
        const transformed = transformData(result, widget);
        setData(transformed);
        onDataFetched?.(transformed);
      }
    } catch (e) {
      setData({ error: "Connection Error", details: "Failed to reach backend" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (widget.refreshInterval) {
      const interval = setInterval(fetchData, widget.refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    return;
  }, [widget.dataSource, widget.refreshInterval, dashboardId, profile]);

  if (loading) {
    return (
      <div className="premium-card h-full w-full p-6 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4 opacity-50"></div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded w-2/3 opacity-30"></div>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="premium-card h-full w-full p-6 flex flex-col items-center justify-center text-center border-rose-500/30">
        <AlertCircle className="text-rose-500 mb-2 opacity-80" size={32} />
        <Text className="text-rose-500 font-bold">{data.error}</Text>
        <Text className="text-slate-500 text-xs mt-1">{data.details}</Text>
      </div>
    );
  }

  if (!data) return null;

  const widgetType = (widget.type || "").toLowerCase().trim();
  const WidgetIcon = widget.config?.icon ? ICON_MAP[widget.config.icon] : null;

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`premium-card h-full w-full p-6 flex flex-col ${className}`}>
      {children}
    </div>
  );

  // Metric Rendering
  if (widgetType === "metric" || widgetType === "number") {
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between">
          <div className="truncate pr-4">
            <Text className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">
              {widget.title}
            </Text>
            <Metric className="mt-2 text-4xl font-black tracking-tighter">
              <span className="metric-value">{formatValue(data.value, widget.config)}</span>
            </Metric>
          </div>
          {WidgetIcon && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-400 shadow-inner">
              <WidgetIcon size={24} />
            </div>
          )}
        </Flex>
        <div className="mt-auto pt-6 flex items-center gap-4">
          {data.delta !== undefined && (
            <BadgeDelta deltaType={data.deltaType || "increase"} size="xs" className="font-bold">
              {data.delta}
            </BadgeDelta>
          )}
          {data.subtext && (
            <Text className="text-slate-500 dark:text-slate-500 text-[11px] font-medium truncate italic opacity-80">
              {data.subtext}
            </Text>
          )}
        </div>
      </CardWrapper>
    );
  }

  // Chart Rendering
  if (["area_chart", "line_chart", "bar_chart", "chart"].includes(widgetType)) {
    const ChartComponent = widgetType === "bar_chart" ? BarChart : (widgetType === "area_chart" || widgetType === "chart") ? AreaChart : LineChart;
    // Improved category/index detection
    let index = widget.config?.index || widget.config?.index_path;
    const series = data.series || [];

    if (!index && series.length > 0) {
      const keys = Object.keys(series[0]);
      index = keys.find(k => ["date", "time", "timestamp", "name", "label", "day", "month"].includes(k.toLowerCase())) || keys[0];
    }

    let categories = widget.config?.categories;
    if (!categories && series.length > 0) {
      categories = Object.keys(series[0]).filter(k => k !== index && !isNaN(parseFloat(String(series[0][k]))));
    }
    if (!categories || categories.length === 0) categories = ["value"];

    return (
      <CardWrapper className="gap-2">
        <div className="mb-2">
          <Title className="text-gradient-animated text-xl font-black tracking-tight">{widget.title}</Title>
          {widget.description && <Subtitle className="text-slate-400 text-xs font-medium">{widget.description}</Subtitle>}
        </div>
        <div className="flex-1 min-h-[260px] w-full">
          {series.length > 0 ? (
            <div className="h-80 w-full mt-4">
              <ChartComponent
                className="h-full w-full"
                data={series}
                index={index}
                categories={categories}
                colors={widget.config?.colors || NEON_COLORS}
                valueFormatter={widget.config?.valueFormatter}
                showLegend={true}
                showAnimation={true}
                showGridLines={false}
                showXAxis={true}
                showYAxis={true}
                yAxisWidth={60}
                curveType="natural"
              />
            </div>
          ) : (
            <div className="h-full w-full flex items-center justify-center opacity-30 border-2 border-dashed border-slate-700 rounded-xl">
              <Text className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Data Points</Text>
            </div>
          )}
        </div>
      </CardWrapper>
    );
  }

  // Donut Rendering
  if (widgetType === "donut_chart" || widgetType === "donut") {
    return (
      <CardWrapper>
        <Title className="text-gradient-animated text-xl font-black tracking-tight mb-8">{widget.title}</Title>
        <div className="flex-1 flex items-center justify-center">
          {data.series && data.series.length > 0 ? (
            <DonutChart
              className="h-72 w-full"
              data={data.series}
              category={widget.config?.category || Object.keys(data.series[0]).find(k => !isNaN(parseFloat(String(data.series[0][k])))) || "value"}
              index={widget.config?.index || widget.config?.index_path || Object.keys(data.series[0]).find(k => ["name", "label", "category", "type", "id"].includes(k.toLowerCase())) || Object.keys(data.series[0])[0]}
              colors={widget.config?.colors || ["cyan", "violet", "indigo", "fuchsia", "rose", "emerald", "amber"]}
              showAnimation={true}
              variant="donut"
              valueFormatter={(v) => `${v.toFixed(1)}%`}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center opacity-30 border-2 border-dashed border-slate-700 rounded-xl">
              <Text className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Data</Text>
            </div>
          )}
        </div>
      </CardWrapper>
    );
  }

  // Progress Rendering
  if (widgetType === "progress" || widgetType === "gauge") {
    const value = data.value || 0;
    const color = widget.color || "cyan";
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between" className="mb-8">
          <div>
            <Text className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">{widget.title}</Text>
            <Metric className="mt-2 font-black text-4xl tracking-tighter">
              <span className="metric-value">{value}%</span>
            </Metric>
          </div>
          <ProgressCircle value={value} size="lg" color={color}>
            <span className="text-sm font-black text-gradient-animated">{value}%</span>
          </ProgressCircle>
        </Flex>
        <div className="mt-auto">
          <Text className="text-slate-500 text-[11px] font-bold mb-3 uppercase tracking-wider">{data.subtext || "Progress"}</Text>
          <ProgressBar value={value} color={color} className="h-3 rounded-full" />
        </div>
      </CardWrapper>
    );
  }

  // Table Rendering
  if (widgetType === "table" || widgetType === "data_table") {
    const headers = data.headers || widget.config?.columns || [];
    const rows = data.rows || [];

    const sortedRows = [...rows].sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      
      const key = sortConfig.key.toLowerCase();
      const aVal = a[key] ?? a[sortConfig.key];
      const bVal = b[key] ?? b[sortConfig.key];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const order = sortConfig.direction === "asc" ? 1 : -1;
      
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * order;
      }
      
      return String(aVal).localeCompare(String(bVal)) * order;
    });

    const handleSort = (key: string) => {
      setSortConfig(prev => {
        if (prev.key === key) {
          if (prev.direction === "asc") return { key, direction: "desc" };
          if (prev.direction === "desc") return { key: "", direction: null };
        }
        return { key, direction: "asc" };
      });
    };

    return (
      <CardWrapper className="p-0 overflow-hidden">
        <div className="p-8 border-b border-slate-200 dark:border-slate-800">
          <Title className="text-gradient-animated text-xl font-black tracking-tight">{widget.title}</Title>
        </div>
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHead>
              <TableRow>
                {headers.map((header: string) => {
                  const isSorted = sortConfig.key === header;
                  return (
                    <TableHeaderCell 
                      key={header} 
                      className="p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                      onClick={() => handleSort(header)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">
                          {header}
                        </span>
                        <div className={`transition-all duration-300 ${isSorted ? "opacity-100 scale-110" : "opacity-0 group-hover:opacity-30"}`}>
                          {sortConfig.direction === "asc" && isSorted ? (
                            <ArrowUp size={12} className="text-accent" />
                          ) : sortConfig.direction === "desc" && isSorted ? (
                            <ArrowDown size={12} className="text-accent" />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </div>
                      </div>
                    </TableHeaderCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedRows.map((row: any, idx: number) => (
                <TableRow key={idx} className="hover:bg-white/5 transition-colors group">
                  {headers.map((header: string) => (
                    <TableCell key={header} className="p-6 text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">
                      {renderTableCell(header, row[header.toLowerCase()] || row[header], widget.config)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper className="border-dashed opacity-40">
      <Flex className="h-full flex-col items-center justify-center text-center p-4">
        <AlertCircle className="text-slate-500 mb-2" size={32} />
        <Text className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Unknown Widget: {widgetType}</Text>
      </Flex>
    </CardWrapper>
  );
}
