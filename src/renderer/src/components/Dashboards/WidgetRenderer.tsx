import { useState, useEffect, useRef } from "react";
import "./Widgets.css";
import {
  Card,
  Metric,
  Text,
  Title,
  Subtitle,
  LineChart,
  BarChart,
  AreaChart,
  DonutChart,
  Legend,
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
  Button,
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
  ArrowUpDown,
  Sparkles,
  Loader2,
  RefreshCw,
  Settings,
  FileText,
  Shield,
  Play
} from "lucide-react";
import { WidgetConfig } from "../../../../main/dashboards";
import { formatValue, formatCellValue } from "./formatUtils";

interface WidgetRendererProps {
  widget: WidgetConfig;
  dashboardId: string;
  profile: string;
  onDataFetched?: (data: any) => void;
  onSummarize?: (data: any, title: string) => void;
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

const TREMOR_COLORS = ["slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];

const normalizeColor = (color?: string): any => {
  if (!color) return "blue";
  const c = color.toLowerCase().trim();
  if (TREMOR_COLORS.includes(c)) return c;
  return "blue";
};

const normalizeVariant = (variant?: string): "primary" | "secondary" | "light" | "danger" => {
  if (!variant) return "primary";
  const v = variant.toLowerCase().trim();
  if (v === "danger" || v === "destructive" || v === "red") return "danger";
  if (v === "outline" || v === "secondary") return "secondary";
  if (v === "ghost" || v === "light") return "light";
  return "primary";
};

const normalizeDeltaType = (type?: string): "increase" | "moderateIncrease" | "decrease" | "moderateDecrease" | "unchanged" => {
  if (!type) return "increase";
  const t = type.toLowerCase().trim();
  if (t.includes("moderate") && t.includes("increase")) return "moderateIncrease";
  if (t.includes("moderate") && t.includes("decrease")) return "moderateDecrease";
  if (t.includes("increase") || t === "up" || t === "positive") return "increase";
  if (t.includes("decrease") || t === "down" || t === "negative") return "decrease";
  if (t === "unchanged" || t === "flat" || t === "stable") return "unchanged";
  return "increase";
};

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

  if (wType === "button_group" || wType === "action" || wType === "buttons") {
    return raw || {};
  }

  return raw;
}

const CardWrapper = ({ 
  children, 
  className = "", 
  onClick, 
  onSummarize, 
  data, 
  title, 
  actions, 
  actionStates, 
  executeAction, 
  isActionType 
}: { 
  children: React.ReactNode, 
  className?: string, 
  onClick?: (e: React.MouseEvent) => void,
  onSummarize?: (data: any, title: string) => void,
  data?: any,
  title: string,
  actions?: any[],
  actionStates?: Record<string, any>,
  executeAction?: (action: any, e: React.MouseEvent) => void,
  isActionType: boolean
}) => (
  <div 
    className={`premium-card h-full w-full p-6 flex flex-col cursor-pointer transition-all hover:scale-[1.01] hover:ring-2 hover:ring-dash-accent/30 group relative overflow-hidden ${className}`}
    onClick={(e) => {
      if (onClick) {
        onClick(e);
      } else if (onSummarize) {
        onSummarize(data, title);
      }
    }}
  >
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-dash-accent/10 p-1.5 rounded-full text-dash-accent">
      <Sparkles size={12} />
    </div>
    {children}
    
    {/* Widget Actions (rendered at the bottom of any regular widget) */}
    {actions && actions.length > 0 && !isActionType && (
      <div 
        className="mt-auto pt-6 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800/50 -mx-6 px-6 bg-slate-50/30 dark:bg-slate-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action) => {
          const state = actionStates?.[action.id || action.label];
          const ActionIcon = action.icon ? ICON_MAP[action.icon] : null;
          
          return (
            <button
              key={action.id || action.label}
              onClick={(e) => executeAction?.(action, e)}
              disabled={state?.loading}
              className={`premium-action-btn ${
                state?.error ? "premium-action-btn-error" : 
                (state?.success ? "premium-action-btn-success" : 
                (normalizeVariant(action.variant) === "primary" ? "premium-action-btn-primary" : 
                 normalizeVariant(action.variant) === "danger" ? "premium-action-btn-danger" : "premium-action-btn-secondary"))
              } ${state?.loading ? "loading" : ""}`}
            >
              {state?.loading ? <Loader2 className="animate-spin-slow" size={14} /> : (ActionIcon && <ActionIcon size={14} />)}
              <span>
                {state?.loading ? "Running..." : (state?.error ? "Failed" : (state?.success ? "Success" : action.label))}
              </span>
            </button>
          );
        })}
      </div>
    )}
  </div>
);

export default function WidgetRenderer({ widget, dashboardId, profile, onDataFetched, onSummarize }: WidgetRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
    key: "",
    direction: null,
  });
  const [actionStates, setActionStates] = useState<Record<string, { loading: boolean; error?: string; success?: boolean }>>({});
  const [inputValue, setInputValue] = useState<string>("");
  // Ref mirrors inputValue so executeAction always reads the live value (avoids stale closure)
  const inputValueRef = useRef<string>("");
  // Only initialize from fetched data once per mount
  const inputInitialized = useRef(false);

  // Set inputValue from loaded data on first fetch only
  useEffect(() => {
    if (!inputInitialized.current && data?.value !== undefined) {
      const v = String(data.value);
      setInputValue(v);
      inputValueRef.current = v;
      inputInitialized.current = true;
    }
  }, [data]);

  const executeAction = async (action: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const actionId = action.id || action.label;
    
    setActionStates(prev => ({ ...prev, [actionId]: { loading: true } }));
    
    try {
      // Strip the {{value}} placeholder from the script path — the value is now
      // passed as a clean separate argument, not interpolated into the command string.
      const scriptPath = action.scriptPath.replace(/\s*\{\{value\}\}/, "").trim();
      const hasValuePlaceholder = action.scriptPath.includes("{{value}}");

      const result = await window.hermesAPI.dashboards.executeAction(
        scriptPath,
        profile,
        hasValuePlaceholder ? inputValueRef.current : undefined,
        dashboardId
      );

      if (result?.error) {
        setActionStates(prev => ({ 
          ...prev, 
          [actionId]: { loading: false, error: result.details || result.error } 
        }));
      } else {
        setActionStates(prev => ({ ...prev, [actionId]: { loading: false, success: true } }));
        
        // Refresh widget data immediately if action was successful
        fetchData();

        // Clear success state after 3 seconds
        setTimeout(() => {
          setActionStates(prev => {
            const newState = { ...prev };
            delete newState[actionId];
            return newState;
          });
        }, 3000);
      }
    } catch (err: any) {
      setActionStates(prev => ({ 
        ...prev, 
        [actionId]: { loading: false, error: err.message || "Execution failed" } 
      }));
    }
  };

  const fetchData = async () => {
    if (!widget.dataSource) {
      setLoading(false);
      return;
    }

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
    if (widget.dataSource) {
      fetchData();
      if (widget.refreshInterval) {
        const interval = setInterval(fetchData, widget.refreshInterval * 1000);
        return () => clearInterval(interval);
      }
    } else {
      setLoading(false);
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

  const widgetType = (widget.type || "").toLowerCase().trim();
  const isActionType = widgetType === "button_group" || widgetType === "action" || widgetType === "buttons" || widgetType === "input" || widgetType === "textarea" || widgetType === "form_input";

  if (!data && !isActionType && widgetType !== "input" && widgetType !== "textarea" && widgetType !== "form_input") return null;
  const renderData = data || {};
  const WidgetIcon = widget.config?.icon ? ICON_MAP[widget.config.icon] : null;


  const wrapperProps = {
    onSummarize,
    data,
    title: widget.title,
    actions: widget.actions,
    actionStates,
    executeAction,
    isActionType
  };

  // Input/Textarea Rendering
  if (widgetType === "input" || widgetType === "textarea" || widgetType === "form_input") {
    const isTextarea = widgetType === "textarea" || widget.config?.multiline;
    return (
      <CardWrapper {...wrapperProps}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {WidgetIcon && (
              <div className="p-2 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500">
                <WidgetIcon size={18} />
              </div>
            )}
            <Title className="text-gradient-animated text-xl font-black tracking-tight leading-none">{widget.title}</Title>
          </div>
        </div>
        
        {widget.description && (
          <Text className="mb-4 text-slate-500 dark:text-slate-400 text-xs font-medium leading-relaxed opacity-80">
            {widget.description}
          </Text>
        )}

        <div className="premium-input-container group" onClick={(e) => e.stopPropagation()}>
          {isTextarea ? (
            <textarea
              className="premium-textarea"
              placeholder={widget.config?.placeholder || "Type here..."}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); inputValueRef.current = e.target.value; }}
              onKeyDown={(e) => e.stopPropagation()}
            />
          ) : (
            <input
              type={widget.config?.type || "text"}
              className="premium-input"
              placeholder={widget.config?.placeholder || "Type here..."}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); inputValueRef.current = e.target.value; }}
              onKeyDown={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* Action Buttons for Input */}
        {widget.actions && widget.actions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            {widget.actions.map((action, i) => {
              const aId = action.id || action.label;
              const aState = actionStates[aId];
              
              let variantClass = "premium-action-btn-secondary";
              if (action.variant === "primary") variantClass = "premium-action-btn-primary";
              if (action.variant === "danger") variantClass = "premium-action-btn-danger";
              if (aState?.success) variantClass = "premium-action-btn-success";
              if (aState?.error) variantClass = "premium-action-btn-error";

              return (
                <button
                  key={aId || i}
                  onClick={(e) => executeAction(action, e)}
                  disabled={aState?.loading}
                  className={`premium-action-btn ${variantClass}`}
                >
                  {aState?.loading && <RefreshCw size={14} className="animate-spin" />}
                  <span>{aState?.success ? "Saved!" : aState?.error ? "Error" : action.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {Object.values(actionStates).some(s => s.error) && (
          <Text className="mt-4 text-rose-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            {Object.values(actionStates).find(s => s.error)?.error}
          </Text>
        )}
      </CardWrapper>
    );
  }

  // Button Group / Action Rendering
  if (isActionType) {
    const actions = widget.actions || (widgetType === "action" ? [{
      id: widget.id,
      label: widget.title,
      scriptPath: widget.dataSource || "",
      icon: widget.config?.icon,
      color: widget.color,
      variant: widget.config?.variant || "primary"
    }] : []);

    return (
      <CardWrapper {...wrapperProps} onClick={(e) => e.stopPropagation()}>
        <Title className="text-gradient-animated text-lg font-black tracking-tight mb-4">{widget.title}</Title>
        {widget.description && <Subtitle className="text-slate-400 text-xs font-medium mb-6">{widget.description}</Subtitle>}
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => {
            const state = actionStates[action.id || action.label];
            const ActionIcon = action.icon ? ICON_MAP[action.icon] : null;
            
            return (
              <button
                key={action.id || action.label}
                onClick={(e) => executeAction(action, e)}
                disabled={state?.loading}
                className={`premium-action-btn ${
                  state?.error ? "premium-action-btn-error" : 
                  (state?.success ? "premium-action-btn-success" : 
                  (normalizeVariant(action.variant) === "primary" ? "premium-action-btn-primary" : 
                   normalizeVariant(action.variant) === "danger" ? "premium-action-btn-danger" : "premium-action-btn-secondary"))
                } ${state?.loading ? "loading" : ""}`}
              >
                {state?.loading ? <Loader2 className="animate-spin-slow" /> : (ActionIcon && <ActionIcon />)}
                <span>
                  {state?.error ? "Failed" : (state?.success ? "Done" : action.label)}
                </span>
              </button>
            );
          })}
        </div>
        {Object.values(actionStates).some(s => s.error) && (
          <Text className="mt-4 text-rose-500 text-[10px] font-bold uppercase tracking-wider animate-pulse">
            {Object.values(actionStates).find(s => s.error)?.error}
          </Text>
        )}
      </CardWrapper>
    );
  }

  // Metric Rendering
  if (widgetType === "metric" || widgetType === "number") {
    return (
      <CardWrapper {...wrapperProps}>
        <Flex alignItems="start" justifyContent="between">
          <div className="truncate pr-4">
            <Text className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">
              {widget.title}
            </Text>
            <Metric className="mt-2 text-4xl font-black tracking-tighter">
              <span className="metric-value">{formatValue(renderData.value, widget.config)}</span>
            </Metric>
          </div>
          {WidgetIcon && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-slate-400 shadow-inner">
              <WidgetIcon size={24} />
            </div>
          )}
        </Flex>
        <div className="mt-auto pt-6 flex items-center gap-4">
          {renderData.delta !== undefined && (
            <BadgeDelta deltaType={normalizeDeltaType(renderData.deltaType || widget.config?.deltaType)} size="xs" className="font-bold">
              {renderData.delta}
            </BadgeDelta>
          )}
          {renderData.subtext && (
            <Text className="text-slate-500 dark:text-slate-500 text-[11px] font-medium truncate italic opacity-80">
              {renderData.subtext}
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
    const series = renderData.series || [];

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
      <CardWrapper {...wrapperProps} className="gap-2">
        <div className="mb-2">
          <Title className="text-gradient-animated text-xl font-black tracking-tight">{widget.title}</Title>
          {widget.description && <Subtitle className="text-slate-400 text-xs font-medium">{widget.description}</Subtitle>}
          {series.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {categories.map((cat: string, i: number) => (
                <div key={cat} className="flex items-center gap-1.5 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: `var(--${(widget.config?.colors || NEON_COLORS)[i % (widget.config?.colors || NEON_COLORS).length]}-500)` }}
                  />
                  <span className="text-[11px] font-medium text-slate-400 truncate max-w-[100px]">{cat}</span>
                </div>
              ))}
            </div>
          )}
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
                showLegend={false}
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
    const series = renderData.series || [];
    const indexKey = widget.config?.index || widget.config?.index_path || (series.length > 0 ? Object.keys(series[0]).find(k => ["name", "label", "category", "type", "id"].includes(k.toLowerCase())) || Object.keys(series[0])[0] : "name");
    const legendCategories = series.map((item: any) => item[indexKey] || "Other");

    return (
      <CardWrapper {...wrapperProps}>
        <div className="mb-6">
          <Title className="text-gradient-animated text-xl font-black tracking-tight">{widget.title}</Title>
          {series.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {legendCategories.map((cat: string, i: number) => (
                <div key={cat} className="flex items-center gap-1.5 min-w-0">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: `var(--${(widget.config?.colors || ["cyan", "violet", "indigo", "fuchsia", "rose", "emerald", "amber"])[i % 7]}-500)` }}
                  />
                  <span className="text-[11px] font-medium text-slate-400 truncate max-w-[100px]">{cat}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          {series.length > 0 ? (
            <DonutChart
              className="h-72 w-full"
              data={series}
              category={widget.config?.category || Object.keys(series[0]).find(k => !isNaN(parseFloat(String(series[0][k])))) || "value"}
              index={indexKey}
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
    const value = renderData.value || 0;
    const color = normalizeColor(widget.color);
    return (
      <CardWrapper {...wrapperProps}>
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
          <Text className="text-slate-500 text-[11px] font-bold mb-3 uppercase tracking-wider">{renderData.subtext || "Progress"}</Text>
          <ProgressBar value={value} color={color} className="h-3 rounded-full" />
        </div>
      </CardWrapper>
    );
  }

  // Table Rendering
  if (widgetType === "table" || widgetType === "data_table") {
    const headers = renderData.headers || widget.config?.columns || [];
    const rows = renderData.rows || [];

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

    const handleSort = (key: string, e: React.MouseEvent) => {
      // Prevent the click from bubbling up to CardWrapper (which would trigger summarize)
      e.stopPropagation();
      setSortConfig(prev => {
        if (prev.key === key) {
          if (prev.direction === "asc") return { key, direction: "desc" };
          if (prev.direction === "desc") return { key: "", direction: null };
        }
        return { key, direction: "asc" };
      });
    };

    return (
      <CardWrapper {...wrapperProps} className="p-0 overflow-hidden">
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
                      onClick={(e) => handleSort(header, e)}
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
    <CardWrapper {...wrapperProps} className="border-dashed opacity-40">
      <Flex className="h-full flex-col items-center justify-center text-center p-4">
        <AlertCircle className="text-slate-500 mb-2" size={32} />
        <Text className="text-slate-500 font-black uppercase tracking-widest text-[10px]">Unknown Widget: {widgetType}</Text>
      </Flex>
    </CardWrapper>
  );
}
