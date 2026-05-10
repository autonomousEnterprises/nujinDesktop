import React from "react";
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Search,
  Code,
  FileText,
  Settings,
  Layers,
  Cpu,
  Database,
  Globe,
  Layout,
  Terminal,
  Play,
  Sparkles
} from "lucide-react";
import AgentMarkdown from "./AgentMarkdown";

// Map string icons to Lucide components
const ICON_MAP: Record<string, any> = {
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Zap,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  Search,
  Code,
  FileText,
  Settings,
  Layers,
  Cpu,
  Database,
  Globe,
  Layout,
  Terminal,
  Play
};

interface VisualBlock {
  type: "text" | "metrics" | "list" | "steps" | "status" | "code" | "table";
  title?: string;
  content?: string;
  items?: any[];
  language?: string;
  columns?: string[];
  rows?: any[][];
}

interface VisualData {
  title?: string;
  subtitle?: string;
  icon?: string;
  status?: "success" | "warning" | "error" | "info" | "neutral";
  blocks?: VisualBlock[];
  actions?: { label: string; command: string; primary?: boolean }[];
  sources?: { label: string; url: string }[];
}

const STATUS_COLORS = {
  success: "text-emerald-500 border-emerald-500/20 bg-emerald-500/[0.03]",
  warning: "text-amber-500 border-amber-500/20 bg-amber-500/[0.03]",
  error: "text-rose-500 border-rose-500/20 bg-rose-500/[0.03]",
  info: "text-sky-500 border-sky-500/20 bg-sky-500/[0.03]",
  neutral: "text-slate-400 border-white/5 bg-white/[0.01]",
};

const VisualResponse: React.FC<{ data: VisualData }> = ({ data }) => {
  const Icon = data.icon ? (ICON_MAP[data.icon] || Info) : (data.status === "success" ? CheckCircle : data.status === "error" ? AlertCircle : Info);
  const statusColor = STATUS_COLORS[data.status || "neutral"];

  return (
    <div className="visual-response flex flex-col gap-4 w-full max-w-full animate-in fade-in slide-in-from-bottom-2 duration-400 font-sans group/visual">
      {/* Header Section */}
      {(data.title || data.subtitle) && (
        <div className={`p-5 rounded-2xl border ${statusColor} flex gap-5 items-start relative overflow-hidden transition-all duration-300 hover:border-white/20`}>
          <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center border border-current opacity-80 ring-4 ring-current/5">
            <Icon size={24} className="text-current" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            {data.title && <h3 className="text-lg font-black tracking-tight mb-1 break-words text-foreground">{data.title}</h3>}
            {data.subtitle && <div className="text-sm opacity-70 leading-relaxed break-words font-medium"><AgentMarkdown>{data.subtitle}</AgentMarkdown></div>}
          </div>
        </div>
      )}

      {/* Main Blocks */}
      {data.blocks?.map((block, idx) => (
        <div key={idx} className="visual-block">
          {block.title && (
            <div className="flex items-center gap-3 mb-3 px-1">
              <div className="h-4 w-1 bg-dash-accent/60 rounded-full"></div>
              <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                {block.title}
              </h4>
              <div className="flex-1 h-[1px] bg-white/[0.03]"></div>
            </div>
          )}

          {block.type === "text" && block.content && (
            <div className="px-1 text-[14px] text-foreground/90 leading-relaxed font-medium">
              <AgentMarkdown>{block.content}</AgentMarkdown>
            </div>
          )}

          {block.type === "metrics" && block.items && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {block.items.map((item, i) => (
                <div key={i} className="p-5 rounded-3xl border border-white/5 bg-white/[0.02] flex flex-col justify-between min-h-[110px] group/metric hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">{item.label}</span>
                    {item.trend && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 ${item.trend === "up" ? "text-emerald-500 bg-emerald-500/10" :
                        item.trend === "down" ? "text-rose-500 bg-rose-500/10" :
                          "text-slate-500 bg-slate-500/10"
                        }`}>
                        {item.trend === "up" ? <TrendingUp size={10} strokeWidth={3} /> : item.trend === "down" ? <TrendingDown size={10} strokeWidth={3} /> : <Minus size={10} strokeWidth={3} />}
                        {item.trend_value || ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tighter text-foreground tabular-nums">{item.value}</span>
                    {item.unit && <span className="text-sm font-bold text-muted-foreground/40 mb-1">{item.unit}</span>}
                  </div>
                  {item.description && (
                    <div className="mt-3 text-[10px] text-muted-foreground/50 font-medium line-clamp-1">{item.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {block.type === "list" && block.items && (
            <div className={`grid gap-4 ${block.items.length > 3 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
              {block.items.map((item, i) => (
                <div key={i} className="flex flex-col gap-3 p-5 rounded-[2rem] border border-white/5 bg-white/[0.015] hover:bg-white/[0.035] hover:border-white/10 transition-all duration-400 group/item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="shrink-0 p-2.5 rounded-2xl bg-dash-accent/10 border border-dash-accent/5 group-hover/item:scale-110 transition-transform">
                      <Zap size={16} className="text-dash-accent opacity-80" strokeWidth={2.5} />
                    </div>
                    {typeof item !== "string" && item.title && (
                      <div className="flex-1 text-[15px] font-black leading-tight text-foreground/90 tracking-tight">
                        {item.title}
                      </div>
                    )}
                  </div>
                  <div className="text-[13px] text-muted-foreground leading-relaxed font-medium">
                    {typeof item === "string" ? <AgentMarkdown>{item}</AgentMarkdown> : <AgentMarkdown>{item.content || item.description || ""}</AgentMarkdown>}
                  </div>
                  {typeof item !== "string" && item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-auto pt-2 text-[10px] font-black text-sky-400/70 hover:text-sky-400 flex items-center gap-1.5 transition-colors">
                      <Globe size={10} /> READ FULL SOURCE
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {block.type === "steps" && block.items && (
            <div className="relative pl-3 space-y-5 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-white/5">
              {block.items.map((step, i) => (
                <div key={i} className="relative flex items-start gap-5 group/step">
                  <div className={`mt-1.5 shrink-0 w-3.5 h-3.5 rounded-full border-[3px] z-10 transition-all duration-300 ${step.status === "completed" ? "bg-emerald-500 border-emerald-500/20" :
                    step.status === "current" ? "bg-dash-accent border-dash-accent/20 scale-125 shadow-[0_0_10px_rgba(96,165,250,0.3)]" :
                      "bg-white/5 border-white/10"
                    }`}>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className={`text-sm font-black mb-1 tracking-tight ${step.status === "current" ? "text-dash-accent" : "text-foreground"}`}>
                      {step.label}
                    </div>
                    {step.description && <div className="text-xs text-muted-foreground/80 leading-relaxed break-words font-medium"><AgentMarkdown>{step.description}</AgentMarkdown></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {block.type === "table" && block.columns && block.rows && (
            <div className="rounded-2xl border border-white/5 overflow-hidden bg-white/[0.01] transition-all hover:border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.03]">
                      {block.columns.map((col, i) => (
                        <th key={i} className="px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/50 border-b border-white/5">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.02]">
                    {block.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-5 py-3.5 text-sm text-foreground/70 font-medium tabular-nums">
                            {typeof cell === "string" ? <AgentMarkdown>{cell}</AgentMarkdown> : cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {block.type === "status" && block.content && (
            <div className={`p-4 rounded-2xl border flex gap-4 items-center transition-all hover:border-white/20 ${STATUS_COLORS[block.status as keyof typeof STATUS_COLORS || "info"]}`}>
              <Info size={18} className="shrink-0 opacity-80" strokeWidth={2.5} />
              <div className="text-sm font-bold flex-1 break-words tracking-tight">{block.content}</div>
            </div>
          )}

          {block.type === "code" && block.content && (
            <div className="mt-2 rounded-2xl overflow-hidden border border-white/5">
              <AgentMarkdown>{`\`\`\`${block.language || "code"}\n${block.content}\n\`\`\``}</AgentMarkdown>
            </div>
          )}
        </div>
      ))}

      {/* Sources Section */}
      {data.sources && data.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 pt-4 border-t border-white/5">
          <div className="w-full text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-2 px-1 flex items-center gap-2">
            <Globe size={10} /> SOURCES
          </div>
          {data.sources.map((source, i) => (
            <a
              key={i}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-sky-400 bg-sky-400/5 border border-sky-400/10 hover:bg-sky-400/10 transition-all flex items-center gap-2 active:scale-[0.96]"
            >
              <Globe size={10} />
              {source.label}
            </a>
          ))}
        </div>
      )}

      {/* Actions Section */}
      {data.actions && data.actions.length > 0 && (
        <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/5">
          <div className="flex flex-wrap gap-2">
            {data.actions.map((action, i) => (
              <button
                key={i}
                className={`px-5 py-3 rounded-2xl text-[11px] font-black tracking-tight transition-all flex items-center gap-2.5 active:scale-[0.96] border shadow-sm cursor-pointer ${action.primary
                  ? "bg-dash-accent text-white border-dash-accent/20 hover:bg-dash-accent/90"
                  : "bg-white/[0.03] text-foreground/80 hover:bg-white/[0.06] border-white/5 hover:border-white/10"
                  }`}
                onClick={() => {
                  if (action.command) {
                    window.dispatchEvent(new CustomEvent("hermes:send-message", { 
                      detail: { 
                        message: action.command,
                        displayText: action.label 
                      } 
                    }));
                  }
                }}
              >
                <Sparkles size={14} className={action.primary ? "text-white" : "text-dash-accent"} strokeWidth={2.5} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualResponse;
