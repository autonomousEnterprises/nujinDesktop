import React, { useState, memo } from "react";
import icon from "../assets/icon.png";
import SmartMessageRenderer from "./SmartMessageRenderer";
import {
  Activity,
  CheckCircle,
  Sparkles,
  ChevronRight,
  ChevronDown
} from "lucide-react";
import { useI18n } from "./useI18n";

export interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  metadata?: any;
  toolSteps?: string[];
}

interface MessageRowProps {
  msg: ChatMessage;
  isLast: boolean;
  isLoading: boolean;
  onApprove: () => void;
  onDeny: () => void;
  isSummarizationResponse?: boolean;
}

const APPROVAL_RE = /⚠️.*dangerous|requires? (your )?approval|\/approve.*\/deny|do you want (me )?to (proceed|continue|run|execute)/i;

function HermesAvatar({ size = 30 }: { size?: number }): React.JSX.Element {
  return (
    <div className="chat-avatar chat-avatar-agent">
      <img src={icon} width={size} height={size} alt="" />
    </div>
  );
}

const ChatMessageRow = memo(function ChatMessageRow({
  msg,
  isLast,
  isLoading,
  onApprove,
  onDeny,
  isSummarizationResponse,
}: MessageRowProps): React.JSX.Element {
  const { t } = useI18n();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Summarization detection (logic from DashboardChat.tsx)
  let isSummarization = false;
  let summaryTitle = "AI Summarization";
  let summaryJson = "";

  if (msg.role === "user") {
    if (msg.metadata?.type === "summarization") {
      isSummarization = true;
      summaryTitle = `AI Summarization: ${msg.metadata.title}`;
      summaryJson = JSON.stringify(msg.metadata.data, null, 2);
    } else if (msg.content.includes("You are a data analyst.")) {
      isSummarization = true;
      const titleMatch = msg.content.match(/\*\*"(.*?)"\*\*/);
      if (titleMatch) {
        summaryTitle = `AI Summarization: ${titleMatch[1]}`;
      }
      const jsonMatch = msg.content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        summaryJson = jsonMatch[1];
      }
    }
  }

  const isAgentSummarizationResponse = isSummarizationResponse || (msg.role === "agent" && msg.content.includes("```summary"));

  // Check if it's a visual message (JSON) to adjust bubble styling
  const trimmedContent = msg.content.trim();
  const isVisual = msg.role === "agent" && (
    (trimmedContent.startsWith("{") && trimmedContent.endsWith("}")) ||
    trimmedContent.includes("```json") ||
    trimmedContent.includes("{\"visual\":")
  );

  if (isSummarization) {
    return (
      <div className="chat-message chat-message-agent">
        <div className="chat-avatar chat-avatar-agent" style={{ background: "transparent" }}>
          <Sparkles size={18} className="text-dash-accent" />
        </div>
        <div className="chat-bubble chat-bubble-agent" style={{ width: "100%", background: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.9 }}>
          <div className="font-semibold mb-2 flex items-center justify-between text-dash-accent text-sm">
            <span className="flex items-center gap-2">
              {summaryTitle}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mb-3 font-medium opacity-70">
            Analyzing data payload for patterns and insights...
          </div>
          <div
            className="cursor-pointer flex items-center gap-1 text-[11px] font-bold text-dash-accent select-none hover:opacity-80 transition-opacity"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            {isCollapsed ? "VIEW RAW DATA" : "HIDE RAW DATA"}
          </div>
          {!isCollapsed && summaryJson && (
            <pre className="mt-3 p-2.5 bg-black/30 rounded-xl overflow-x-auto text-[10px] text-muted-foreground border border-white/5 whitespace-pre-wrap font-mono leading-relaxed">
              {summaryJson}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`chat-message chat-message-${msg.role} ${isVisual ? "chat-message-visual" : ""}`}>
      {msg.role === "user" ? (
        <div className="chat-avatar chat-avatar-user">U</div>
      ) : isAgentSummarizationResponse ? (
        <div className="chat-avatar chat-avatar-agent" style={{ background: "transparent" }} />
      ) : (
        <HermesAvatar />
      )}
      <div className="flex flex-col gap-2 w-full min-w-0">
        {msg.toolSteps && msg.toolSteps.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-1 pl-3 border-l-2 border-slate-200 dark:border-slate-800 ml-1">
            {msg.toolSteps.map((step, i) => {
              const isLastStep = i === msg.toolSteps!.length - 1;
              const isActive = isLastStep && isLoading && isLast;
              return (
                <div key={i} className={`flex items-start gap-2.5 text-[13px] transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-50"}`}>
                  <div className="mt-0.5 shrink-0 w-3.5 flex justify-center">
                    {isActive ? (
                      <Activity size={14} className="animate-pulse text-dash-accent" />
                    ) : (
                      <CheckCircle size={14} className="text-emerald-500/60" />
                    )}
                  </div>
                  <span className="text-muted-foreground break-words whitespace-normal leading-relaxed min-w-0 flex-1 font-medium">{step}</span>
                </div>
              );
            })}
          </div>
        )}

        {(msg.content.trim() !== "" || isAgentSummarizationResponse) && (
          <div
            className={`chat-bubble chat-bubble-${msg.role} ${isVisual ? "chat-bubble-visual" : ""}`}
            style={isAgentSummarizationResponse ? { width: "100%", backgroundColor: "transparent", background: "transparent", border: "none", padding: 0, boxShadow: "none" } : undefined}
          >
            {msg.role === "agent" ? (
              isLoading && isLast && (msg.content.trim().startsWith("{") || msg.content.includes("\"visual\"")) ? (
                <div className="flex items-center gap-2.5 py-2 px-1 text-dash-accent/60">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"></span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Typing...</span>
                </div>
              ) : (
                <SmartMessageRenderer>{msg.content}</SmartMessageRenderer>
              )
            ) : (
              msg.content
            )}
          </div>
        )}
      </div>
      {msg.role === "agent" &&
        !isLoading &&
        isLast &&
        APPROVAL_RE.test(msg.content) && (
          <div className="chat-approval-bar">
            <button
              className="chat-approval-btn chat-approve"
              onClick={onApprove}
            >
              {t("chat.approve")}
            </button>
            <button className="chat-approval-btn chat-deny" onClick={onDeny}>
              {t("chat.deny")}
            </button>
          </div>
        )}
    </div>
  );
});

export default ChatMessageRow;
