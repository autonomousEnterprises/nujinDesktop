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

const renderTableCell = (header: string, value: any) => {
  if (value === undefined || value === null) return "-";
  
  const h = header.toLowerCase();
  if (h === "status") {
    const color = value.toLowerCase() === "active" || value.toLowerCase() === "vip" ? "green" : 
                 value.toLowerCase() === "new" ? "blue" : "gray";
    return (
      <Badge color={color} size="xs" className="rounded-full px-2 py-0 font-bold text-[9px] uppercase">
        {value}
      </Badge>
    );
  }

  if (typeof value === "string" && (value.startsWith("$") || h.includes("price") || h.includes("value") || h.includes("purchases"))) {
    return <span className="font-bold text-slate-900 dark:text-white">{value}</span>;
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  return value;
};

export default function WidgetRenderer({ widget, dashboardId, profile, onDataFetched }: WidgetRendererProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const result = await window.hermesAPI.dashboards.getWidgetData(dashboardId, widget.dataSource, profile);
      if (result) {
        setData(result);
        onDataFetched?.(result);
      }
    } catch (e) {
      console.error("Failed to fetch widget data", e);
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
      <div className="h-full w-full bg-secondary border border-border rounded-[24px] p-6 animate-pulse flex flex-col justify-between shadow-sm">
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded-full w-1/3"></div>
          <div className="h-8 bg-muted rounded-full w-2/3"></div>
        </div>
        <div className="h-20 bg-muted/50 rounded-2xl w-full"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full w-full bg-secondary border border-border rounded-[24px] p-6 flex items-center justify-center shadow-sm">
        <Text className="text-muted-foreground italic">Missing data: {widget.title}</Text>
      </div>
    );
  }

  const CardWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
    // Determine dynamic background based on variant
    let bgClass = "bg-secondary";
    let borderClass = "border-border";
    let textClass = "text-foreground";
    let glow = "";

    if (widget.variant === "gradient") {
      bgClass = `bg-gradient-to-br from-${widget.color || "blue"}-500/10 to-transparent`;
      borderClass = `border-${widget.color || "blue"}-500/20`;
      glow = `after:absolute after:inset-0 after:bg-${widget.color || "blue"}-500/5 after:blur-3xl after:-z-10`;
    } else if (widget.variant === "solid") {
      bgClass = `bg-${widget.color || "blue"}-600`;
      borderClass = "border-none";
      textClass = "text-white";
    } else if (widget.variant === "glass") {
      bgClass = "bg-white/5 backdrop-blur-md";
      borderClass = "border-white/10";
    }

    return (
      <div className={`group relative w-full border rounded-[28px] p-7 transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl z-10 ${bgClass} ${borderClass} ${textClass} ${glow} ${className}`}>
         <div className="relative z-10 flex flex-col">
            {children}
         </div>
      </div>
    );
  };

  const WidgetIcon = widget.config?.icon ? ICON_MAP[widget.config.icon] : null;
  const widgetType = (widget.type || "").toLowerCase().trim();
  console.log(`[WidgetRenderer] Rendering ${widget.id} (${widgetType})`);

  // Metric Rendering
  if (widgetType === "metric") {
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between">
          <div className="space-y-1">
            <Text className={`text-[10px] font-black uppercase tracking-[0.2em] opacity-60`}>
              {widget.title}
            </Text>
            <Metric className={`text-4xl font-black tracking-tight leading-none pt-2`}>
              {data.value}
            </Metric>
          </div>
          {WidgetIcon && (
            <div className={`p-3 rounded-[18px] bg-white/10 shadow-inner`}>
              <WidgetIcon size={24} className="opacity-80" />
            </div>
          )}
        </Flex>
        
        <div className="mt-4">
          <Flex justifyContent="start" className="gap-3 items-center">
            {data.delta && (
              <BadgeDelta deltaType={data.deltaType || "increase"} className="rounded-full px-3 py-1 font-bold text-[10px] shadow-sm">
                {data.delta}
              </BadgeDelta>
            )}
            {data.subtext && (
              <Text className="text-xs font-bold opacity-50 truncate">
                {data.subtext}
              </Text>
            )}
          </Flex>
        </div>
      </CardWrapper>
    );
  }

  // Chart Rendering
  if (widgetType === "area_chart" || widgetType === "line_chart" || widgetType === "chart") {
    const ChartComponent = (widgetType === "area_chart" || widgetType === "chart") ? AreaChart : LineChart;
    return (
      <CardWrapper>
        <div className="mb-4">
          <Title className="text-xl font-black tracking-tight">{widget.title}</Title>
          {widget.description && <Subtitle className="text-xs opacity-60 mt-1 font-medium">{widget.description}</Subtitle>}
        </div>
        <div className="h-[300px] w-full mt-4">
          <ChartComponent
            className="h-full w-full"
            data={data.series || []}
            index={widget.config?.index || "date"}
            categories={widget.config?.categories || ["value"]}
            colors={widget.config?.colors || [widget.color || "blue"]}
            valueFormatter={widget.config?.valueFormatter}
            showLegend={widget.gridSize !== "small" && widget.gridSize !== "medium"}
            showXAxis={true}
            showYAxis={widget.gridSize !== "small"}
            showGridLines={false}
            curveType="monotone"
            showAnimation={true}
            yAxisWidth={48}
          />
        </div>
      </CardWrapper>
    );
  }

  // Donut Rendering
  if (widgetType === "donut_chart" || widgetType === "donut") {
    return (
      <CardWrapper>
        <Title className="text-xl font-black mb-2 tracking-tight">{widget.title}</Title>
        <div className="h-[200px] w-full flex items-center justify-center p-2">
          <DonutChart
            className="h-full w-full"
            data={data.series || []}
            category={widget.config?.category || "value"}
            index={widget.config?.index || "name"}
            colors={widget.config?.colors || ["blue", "cyan", "indigo", "violet"]}
            showAnimation={true}
            variant="donut"
            valueFormatter={widget.config?.valueFormatter}
            showLabel={false}
          />
        </div>
        {widget.gridSize !== "small" && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 justify-center">
            {(data.series || []).slice(0, 4).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full bg-${(widget.config?.colors || ["blue", "cyan", "indigo", "violet"])[i]}-500 shadow-glow`}></div>
                 <Text className="text-[9px] font-black uppercase tracking-tighter opacity-70 truncate">{item[widget.config?.index || "name"]}</Text>
              </div>
            ))}
          </div>
        )}
      </CardWrapper>
    );
  }

  // Progress Rendering
  if (widgetType === "progress" || widgetType === "gauge") {
    return (
      <CardWrapper>
        <Flex alignItems="start" justifyContent="between">
           <div className="space-y-1">
              <Text className="text-[10px] font-black uppercase tracking-widest opacity-60">{widget.title}</Text>
              <Metric className="text-3xl font-black tracking-tighter">{data.value}%</Metric>
           </div>
           <ProgressCircle 
              value={data.value} 
              size="md" 
              color={widget.color || "blue"}
              showAnimation={true}
           >
              <span className="text-[10px] font-black">{data.value}%</span>
           </ProgressCircle>
        </Flex>
        <div className="mt-auto">
           <Text className="text-[10px] font-bold opacity-60 mb-2 uppercase tracking-tight">{data.subtext || "Goal Status"}</Text>
           <ProgressBar value={data.value} color={widget.color || "blue"} className="h-2 rounded-full" />
        </div>
      </CardWrapper>
    );
  }

  // Table Rendering
  if (widgetType === "table") {
    return (
      <CardWrapper className="p-0 overflow-hidden flex flex-col">
        <div className="p-6 pb-3">
          <Title className="text-lg font-black tracking-tight leading-tight">{widget.title}</Title>
          {widget.description && <Text className="text-[10px] opacity-50 font-bold uppercase tracking-tighter mt-0.5">{widget.description}</Text>}
        </div>
          <div className="overflow-x-auto max-h-full pb-2">
            <Table className="mt-2 border-collapse">
              <TableHead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 dark:border-slate-800">
                <TableRow className="hover:bg-transparent">
                  {(data.headers || widget.config?.columns || []).map((header: string) => (
                    <TableHeaderCell key={header} className="text-[10px] uppercase tracking-wider py-2 font-semibold text-slate-400">
                      {header}
                    </TableHeaderCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(data.rows || []).map((row: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50">
                    {(data.headers || widget.config?.columns || []).map((header: string) => (
                      <TableCell key={header} className="py-2.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {renderTableCell(header, row[header.toLowerCase()] || row[header])}
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

  // Fallback for unknown types
  return (
    <CardWrapper className="border-red-500/20 bg-red-500/5">
      <Flex className="h-full flex-col items-center justify-center text-center gap-4">
        <div className="p-4 bg-red-500/10 rounded-full">
           <AlertCircle className="text-red-500" size={32} />
        </div>
        <div>
          <Text className="font-black text-red-500 uppercase tracking-widest text-[10px]">Unsupported Widget</Text>
          <Metric className="text-xl font-black mt-1">{widget.type}</Metric>
          <Text className="mt-2 text-xs opacity-60">Check configuration for typos.</Text>
        </div>
      </Flex>
    </CardWrapper>
  );
}
