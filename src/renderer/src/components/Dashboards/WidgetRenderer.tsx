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
  AlertCircle
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
};

const renderTableCell = (header: string, value: any, widgetConfig?: any) => {
  if (value === undefined || value === null) return "—";
  
  const h = header.toLowerCase();
  if (h === "status") {
    const color = value.toLowerCase() === "active" || value.toLowerCase() === "vip" ? "emerald" : 
                 value.toLowerCase() === "new" ? "blue" : "slate";
    return (
      <Badge color={color} size="xs" className="rounded-full">
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
    if (sPath && !raw.series) {
      return { series: getNestedValue(raw, sPath) || [] };
    }
    return raw;
  }

  return raw;
}

export default function WidgetRenderer({ widget, dashboardId, profile, onDataFetched }: WidgetRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await window.hermesAPI.dashboards.getWidgetData(dashboardId, widget.dataSource, profile);
      
      if (result && result.error) {
        setData({ error: result.error, details: result.details });
      } else if (result) {
        const transformed = transformData(result, widget);
        setData(transformed);
        onDataFetched?.(transformed);
      } else {
        setData(null);
      }
    } catch (e) {
      console.error("Failed to fetch widget data", e);
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
      <div className="h-full w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 animate-pulse shadow-sm">
        <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="h-full w-full bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-6 flex flex-col items-center justify-center text-center">
        <AlertCircle className="text-rose-500 mb-2" size={24} />
        <Text className="text-rose-700 dark:text-rose-400 font-bold">{data.error}</Text>
      </div>
    );
  }

  if (!data) return null;

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <div className={`h-full w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col ${className}`}>
      {children}
    </div>
  );

  const widgetType = (widget.type || "").toLowerCase().trim();
  const WidgetIcon = widget.config?.icon ? ICON_MAP[widget.config.icon] : null;

  // Metric Rendering
  if (widgetType === "metric" || widgetType === "number") {
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between">
          <div className="truncate">
            <Text className="text-slate-500 dark:text-slate-400 font-medium truncate uppercase tracking-wider text-[11px]">
              {widget.title}
            </Text>
            <Metric className="text-slate-900 dark:text-slate-50 font-bold mt-1">
              {formatValue(data.value, widget.config)}
            </Metric>
          </div>
          {WidgetIcon && (
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400">
              <WidgetIcon size={20} />
            </div>
          )}
        </Flex>
        <div className="mt-auto pt-4 flex items-center gap-3">
          {data.delta && (
            <BadgeDelta deltaType={data.deltaType || "increase"} size="xs">
              {data.delta}
            </BadgeDelta>
          )}
          {data.subtext && (
            <Text className="text-slate-400 dark:text-slate-500 text-xs truncate">
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
    const index = widget.config?.index || "date";
    const series = data.series || [];
    
    // Auto-detect categories if not provided
    let categories = widget.config?.categories;
    if (!categories && series.length > 0) {
      categories = Object.keys(series[0]).filter(k => k !== index && typeof series[0][k] === "number");
    }
    if (!categories || categories.length === 0) categories = ["value"];

    return (
      <CardWrapper>
        <div className="mb-4">
          <Title className="text-slate-900 dark:text-slate-50 text-lg font-bold">{widget.title}</Title>
          {widget.description && <Subtitle className="text-slate-500 dark:text-slate-400 text-xs">{widget.description}</Subtitle>}
        </div>
        <div className="flex-1 min-h-[220px]">
          <ChartComponent
            className="h-full w-full mt-4"
            data={series}
            index={index}
            categories={categories}
            colors={widget.config?.colors || ["blue", "indigo", "cyan", "emerald", "violet", "rose"]}
            valueFormatter={widget.config?.valueFormatter}
            showLegend={true}
            showAnimation={true}
            showGridLines={true}
            curveType="smooth"
          />
        </div>
      </CardWrapper>
    );
  }

  // Donut Rendering
  if (widgetType === "donut_chart" || widgetType === "donut") {
    return (
      <CardWrapper>
        <Title className="text-slate-900 dark:text-slate-50 text-lg font-bold mb-4">{widget.title}</Title>
        <div className="flex-1 flex flex-col justify-center">
          <DonutChart
            className="h-52 w-full"
            data={data.series || []}
            category={widget.config?.category || "value"}
            index={widget.config?.index || "name"}
            colors={widget.config?.colors || ["blue", "cyan", "indigo", "violet", "emerald"]}
            showAnimation={true}
          />
        </div>
      </CardWrapper>
    );
  }

  // Progress Rendering
  if (widgetType === "progress" || widgetType === "gauge") {
    const value = data.value || 0;
    const color = widget.color || "blue";
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between" className="mb-6">
          <div>
            <Text className="text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider text-[11px]">{widget.title}</Text>
            <Metric className="text-slate-900 dark:text-slate-50 font-bold mt-1">{value}%</Metric>
          </div>
          <ProgressCircle value={value} size="md" color={color}>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-50">{value}%</span>
          </ProgressCircle>
        </Flex>
        <div className="mt-auto">
          <Text className="text-slate-400 dark:text-slate-500 text-xs mb-2">{data.subtext || "Completion Status"}</Text>
          <ProgressBar value={value} color={color} className="mt-2" />
        </div>
      </CardWrapper>
    );
  }

  // Table Rendering
  if (widgetType === "table" || widgetType === "data_table") {
    const headers = data.headers || widget.config?.columns || [];
    return (
      <CardWrapper className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <Title className="text-slate-900 dark:text-slate-50 text-lg font-bold">{widget.title}</Title>
        </div>
        <div className="overflow-x-auto flex-1">
          <Table>
            <TableHead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0">
              <TableRow>
                {headers.map((header: string) => (
                  <TableHeaderCell key={header} className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    {header}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(data.rows || []).map((row: any, idx: number) => (
                <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  {headers.map((header: string) => (
                    <TableCell key={header} className="text-slate-700 dark:text-slate-300">
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
    <CardWrapper className="border-dashed border-2 opacity-50">
      <Flex className="h-full flex-col items-center justify-center text-center p-4">
        <AlertCircle className="text-slate-400 mb-2" size={24} />
        <Text className="text-slate-500 font-bold uppercase text-[10px]">Unknown: {widgetType}</Text>
      </Flex>
    </CardWrapper>
  );
}
