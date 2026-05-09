import React, { useState, useEffect, memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, AlertTriangle, CheckCircle, Info, Activity, AlertCircle, ArrowRight, Zap } from "lucide-react";
import { useI18n } from "./useI18n";

// Lazy-load the heavy syntax highlighter — only imported when a code block renders
let _highlighterMod: typeof import("react-syntax-highlighter") | null = null;
let _oneDark: Record<string, React.CSSProperties> | null = null;
let _loadingPromise: Promise<void> | null = null;

function loadHighlighter(): Promise<void> {
  if (_highlighterMod && _oneDark) return Promise.resolve();
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = Promise.all([
    import("react-syntax-highlighter"),
    import("react-syntax-highlighter/dist/esm/styles/prism/one-dark"),
  ]).then(([mod, style]) => {
    _highlighterMod = mod;
    _oneDark = style.default;
  });
  return _loadingPromise;
}

// Diff viewer with colored +/- lines
function DiffView({ code }: { code: string }): React.JSX.Element {
  const lines = code.split("\n");
  return (
    <div className="chat-diff-content">
      {lines.map((line, i) => {
        let cls = "chat-diff-line";
        if (line.startsWith("+")) cls += " chat-diff-add";
        else if (line.startsWith("-")) cls += " chat-diff-remove";
        else if (line.startsWith("@@")) cls += " chat-diff-hunk";
        return (
          <div key={i} className={cls}>
            {line || "\u00A0"}
          </div>
        );
      })}
    </div>
  );
}

// Code block with syntax highlighting and copy button (lazy-loaded highlighter)
function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [highlighterReady, setHighlighterReady] = useState(
    () => _highlighterMod !== null && _oneDark !== null,
  );
  const code = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const isDiff = language === "diff";

  // Trigger lazy load when code block mounts
  useEffect(() => {
    if (!highlighterReady) {
      loadHighlighter().then(() => setHighlighterReady(true));
    }
  }, [highlighterReady]);

  function handleCopy(): void {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fallbackPre = (
    <pre
      style={{
        margin: 0,
        borderRadius: 0,
        fontSize: "13px",
        padding: "12px",
        background: "transparent",
        color: "#abb2bf",
        overflow: "auto",
      }}
    >
      {code}
    </pre>
  );

  return (
    <div className="chat-code-block">
      <div className="chat-code-header">
        <span className="chat-code-lang">
          {isDiff ? "diff" : language || "code"}
        </span>
        <button className="chat-code-copy" onClick={handleCopy}>
          {copied ? t("common.copied") : <Copy size={13} />}
        </button>
      </div>
      {isDiff ? (
        <DiffView code={code} />
      ) : highlighterReady && _highlighterMod && _oneDark ? (
        <_highlighterMod.Prism
          style={_oneDark}
          language={language || "text"}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "13px",
            padding: "12px",
            background: "transparent",
          }}
        >
          {code}
        </_highlighterMod.Prism>
      ) : (
        fallbackPre
      )}
    </div>
  );
}

function SummaryView({ code }: { code: string }): React.JSX.Element {
  let data;
  try {
    data = JSON.parse(code);
  } catch (e) {
    // If it's streaming or invalid, just show the raw code but styled a bit
    return (
      <div className="p-3 bg-black/20 border border-white/5 rounded-md mb-2">
        <div className="text-xs text-muted-foreground animate-pulse mb-2">Analyzing data...</div>
        <pre className="text-[11px] text-muted-foreground/70 overflow-x-auto whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  const signals = {
    good: { icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    alert: { icon: AlertCircle, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    neutral: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  };

  const signal = signals[data.signal_type as keyof typeof signals] || signals.neutral;
  const SignalIcon = signal.icon;

  return (
    <div className="flex flex-col gap-3 my-2 font-sans w-full max-w-full overflow-hidden">
      <div className={`p-3 pr-4 rounded-lg border ${signal.border} ${signal.bg} flex gap-3 items-start w-full`}>
        <SignalIcon className={`shrink-0 mt-0.5 ${signal.color}`} size={18} />
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold mb-1 ${signal.color} break-words whitespace-normal pr-2`}>
            {String(data.signal_type).toUpperCase()} SIGNAL: {data.signal_reason}
          </div>
          <div className="text-sm text-foreground/90 leading-relaxed break-words whitespace-normal pr-2">
            {data.what_it_is}
          </div>
        </div>
      </div>

      {data.standouts && Array.isArray(data.standouts) && data.standouts.length > 0 && (
        <div className="p-3 pr-4 rounded-lg border border-slate-500/20 bg-slate-500/5 w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 break-words">
            <Activity size={14} className="shrink-0" /> Standouts & Anomalies
          </div>
          <ul className="space-y-2 m-0 p-0 list-none">
            {data.standouts.map((s: string, i: number) => (
              <li key={i} className="text-sm flex gap-2 items-start leading-relaxed text-foreground/90 break-words whitespace-normal min-w-0">
                <Zap size={14} className="text-dash-accent shrink-0 mt-0.5 opacity-70" />
                <span className="min-w-0 flex-1 break-words whitespace-normal pr-2">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.next_steps && Array.isArray(data.next_steps) && data.next_steps.length > 0 && (
        <div className="p-3 pr-4 rounded-lg border border-slate-500/20 bg-slate-500/5 w-full">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 break-words">
            <CheckCircle size={14} className="shrink-0" /> What to Monitor
          </div>
          <ul className="space-y-2 m-0 p-0 list-none">
            {data.next_steps.map((s: string, i: number) => (
              <li key={i} className="text-sm flex gap-2 items-start leading-relaxed text-foreground/90 break-words whitespace-normal min-w-0">
                <ArrowRight size={14} className="text-dash-accent shrink-0 mt-0.5 opacity-70" />
                <span className="min-w-0 flex-1 break-words whitespace-normal pr-2">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.bottom_line && (
        <div className="text-sm font-medium border-l-[3px] border-dash-accent pl-3 pr-4 py-1.5 mt-1 text-foreground/90 leading-relaxed bg-slate-500/5 rounded-r-md break-words whitespace-normal w-full min-w-0">
          {data.bottom_line}
        </div>
      )}
    </div>
  );
}

// Shared Markdown renderer that opens links externally
const AgentMarkdown = memo(function AgentMarkdown({ children }: { children: string }): React.JSX.Element {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children, ...props }) => {
          // ReactMarkdown passes the <code> element as the only child of <pre>
          const child = React.Children.toArray(children)[0];
          if (
            React.isValidElement(child) &&
            child.props.className === "language-summary"
          ) {
            // Strip the <pre> formatting entirely for summarization blocks
            return <div className="w-full p-0 m-0 bg-transparent">{children}</div>;
          }
          return <pre {...props}>{children}</pre>;
        },
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              if (!href) return;
              try {
                const url = new URL(href, "https://placeholder.invalid");
                if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
                  return;
                }
              } catch {
                return;
              }
              window.hermesAPI.openExternal(href);
            }}
          >
            {children}
          </a>
        ),
        code: ({ className, children, ...props }) => {
          const isInline =
            !className &&
            typeof children === "string" &&
            !children.includes("\n");
          if (isInline) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          if (className === "language-summary") {
            return <SummaryView code={String(children).replace(/\n$/, "")} />;
          }
          return <CodeBlock className={className}>{children}</CodeBlock>;
        },
      }}
    >
      {children}
    </Markdown>
  );
});

export { AgentMarkdown };
export default AgentMarkdown;
