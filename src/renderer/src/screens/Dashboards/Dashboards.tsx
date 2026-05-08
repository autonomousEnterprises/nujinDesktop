import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles } from "lucide-react";
import DashboardChat, { DashboardChatHandle } from "./DashboardChat";
import { ChatMessage } from "../Chat/Chat";
import DashboardGrid, { DashboardGridHandle } from "../../components/Dashboards/DashboardGrid";
import { DashboardConfig } from "../../../../main/dashboards";
import "./Dashboards.css";

interface DashboardsProps {
  profile: string;
  selectedDashboardId?: string | null;
  onDashboardSelected?: (id: string | null) => void;
}

export default function Dashboards({ profile, selectedDashboardId, onDashboardSelected }: DashboardsProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  const chatRef = useRef<DashboardChatHandle>(null);
  const gridRef = useRef<DashboardGridHandle>(null);

  // Persistence for chats per dashboard
  const [dashboardChats, setDashboardChats] = useState<Record<string, ChatMessage[]>>({});
  const [dashboardSessions, setDashboardSessions] = useState<Record<string, string | null>>({});

  // When messages or sessionId change, update our in-memory persistence
  useEffect(() => {
    const key = currentDashboard ? currentDashboard.id : "new_dashboard";
    setDashboardChats(prev => ({ ...prev, [key]: messages }));
    setDashboardSessions(prev => ({ ...prev, [key]: currentSessionId }));
  }, [messages, currentSessionId, currentDashboard?.id]);

  const loadDashboardList = useCallback(async () => {
    const list = await window.hermesAPI.dashboards.list(profile);
    return list;
  }, [profile]);

  const switchDashboard = async (id: string) => {
    if (!id) {
      setCurrentDashboard(null);
      return;
    }

    const config = await window.hermesAPI.dashboards.get(id, profile);
    if (config) {
      const sid = config.sessionId || null;
      
      // If we're already on this dashboard and session, don't trigger a full reload
      // which might cause a flicker or race condition with active streams.
      if (currentDashboard?.id === id && currentSessionId === sid && messages.length > 0) {
        setCurrentDashboard(config); // Just in case other fields changed
        return;
      }

      setCurrentDashboard(config);
      setCurrentSessionId(sid);

      // If we have a session, try to hydrate from DB
      if (sid) {
        try {
          const dbMessages = await window.hermesAPI.getSessionMessages(sid);
          if (dbMessages && dbMessages.length > 0) {
            const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
              id: `db-${m.id || Math.random()}`,
              role: m.role === "user" ? "user" : "agent",
              content: m.content,
            }));
            setMessages(chatMessages);
            setDashboardChats(prev => ({ ...prev, [config.id]: chatMessages }));
          } else {
            // DB is empty but we have a session ID? 
            // Fallback to memory cache if available
            setMessages(dashboardChats[config.id] || []);
          }
        } catch (err) {
          console.error("Failed to fetch session messages for dashboard", err);
          setMessages(dashboardChats[config.id] || []);
        }
      } else {
        // No session, use memory cache
        setMessages(dashboardChats[config.id] || []);
      }
    }
  };

  // Sync with external selectedDashboardId
  useEffect(() => {
    if (selectedDashboardId !== undefined) {
      if (selectedDashboardId === null) {
        if (currentDashboard) handleNewChat();
      } else if (selectedDashboardId !== currentDashboard?.id) {
        switchDashboard(selectedDashboardId);
      }
    }
  }, [selectedDashboardId]);

  // Load dashboards on mount
  useEffect(() => {
    loadDashboardList();
  }, [loadDashboardList]);

  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Listen for updates from Hermes background scripts or new dashboard creations
  useEffect(() => {
    const cleanup = window.hermesAPI.dashboards.onUpdate((filename) => {
      loadDashboardList().then(list => {
        // If we are in the blank state and a new dashboard appears, auto-select it!
        if (!currentDashboard && list.length > 0) {
          const newId = filename.replace(".json", "");
          window.hermesAPI.dashboards.get(newId, profile).then(config => {
            // Bind the active session to the newly created dashboard
            // We use sessionIdRef to get the absolute latest value even if this closure is stale
            if (config && sessionIdRef.current && !config.sessionId) {
              const updated = { ...config, sessionId: sessionIdRef.current };
              window.hermesAPI.dashboards.save(newId, updated, profile);
              switchDashboard(newId);
            } else if (!currentDashboard) {
              switchDashboard(newId);
            }
          });
        }
      });
      if (currentDashboard && filename.startsWith(currentDashboard.id)) {
        window.hermesAPI.dashboards.get(currentDashboard.id, profile).then(setCurrentDashboard);
      }
    });
    return cleanup;
  }, [currentDashboard, profile, loadDashboardList]);

  const handleNewChat = useCallback(() => {
    setDashboardChats(prev => ({ ...prev, new_dashboard: [] }));
    setDashboardSessions(prev => ({ ...prev, new_dashboard: null }));
    setMessages([]);
    setCurrentSessionId(null);
    setCurrentDashboard(null);
    if (onDashboardSelected) onDashboardSelected(null);
  }, [onDashboardSelected]);

  const handleSummarizeWidget = useCallback((data: any, title: string) => {
    if (!isSidebarOpen) setIsSidebarOpen(true);
    
    const prompt = `You are a data analyst. I'm looking at the **"${title}"** widget on my dashboard.

Here is the raw data behind it:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

**Do NOT repeat or list the raw data back to me.**

Instead, tell me:
- What does this data actually mean? Is this good, bad, or normal?
- Are there any standout values, trends, anomalies, or warning signs I should pay attention to?
- What should I do or watch based on this? Any concrete next steps or things to monitor?

Be direct and concise. Write like a smart colleague giving me a quick verbal briefing, not a formal report.`;
    chatRef.current?.sendMessage(prompt);
  }, [isSidebarOpen]);

  const handleSummarizeDashboard = useCallback(() => {
    if (!currentDashboard) return;
    if (!isSidebarOpen) setIsSidebarOpen(true);
    
    const allData = gridRef.current?.getDashboardData() || {};
    const prompt = `You are a data analyst. I'm looking at my **"${currentDashboard.title}"** dashboard.

Here is the raw data from all widgets:
\`\`\`json
${JSON.stringify(allData, null, 2)}
\`\`\`

**Do NOT repeat or list the raw numbers back to me.**

Give me an executive-level briefing:
- What is the overall picture? What story does this data tell right now?
- What are the most important signals — the things I should actually care about?
- Are there any anomalies, risks, opportunities, or red flags?
- What are the 2-3 most important things I should act on or keep an eye on?

Be sharp, direct, and prioritised. Skip anything that's normal and unremarkable. Focus on what matters.`;
    
    chatRef.current?.sendMessage(prompt);
  }, [currentDashboard, isSidebarOpen]);

  const handleRefresh = useCallback(async () => {
    if (!currentDashboard) return;
    // 1. Clear the server-side script result cache so all widgets get fresh data
    await window.hermesAPI.dashboards.clearCache();
    // 2. Reload the dashboard config (in case the AI changed it)
    const config = await window.hermesAPI.dashboards.get(currentDashboard.id, profile);
    if (config) setCurrentDashboard(config);
    // 3. Bump refreshKey so all WidgetRenderer instances remount and re-fetch
    setRefreshKey(k => k + 1);
  }, [currentDashboard, profile]);

  const handleDeleteDashboard = useCallback(async (id: string) => {
    console.log(`[Dashboards] Deleting dashboard: ${id}`);
    const success = await window.hermesAPI.dashboards.delete(id, profile);
    console.log(`[Dashboards] Deletion success: ${success}`);
    if (success) {
      // 1. Small delay
      await new Promise(r => setTimeout(r, 100));
      // 2. Refresh the list
      await loadDashboardList();
      // 3. If the deleted dashboard was the current one, switch to blank state
      if (currentDashboard?.id === id) {
        handleNewChat();
      }
    } else {
      alert("Failed to delete dashboard. Check logs for details.");
    }
  }, [currentDashboard, profile, loadDashboardList, handleNewChat]);

  return (
    <div className={`dashboards-screen ${currentDashboard ? "split-view" : "full-chat"}`}>
      <aside className={`chat-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <DashboardChat
          ref={chatRef}
          messages={messages}
          setMessages={setMessages}
          profile={profile}
          onNewChat={handleNewChat}
          compact={!!currentDashboard}
          dashboardContext={currentDashboard || undefined}
          sessionId={currentSessionId}
          onSessionStarted={(sid) => {
            setCurrentSessionId(sid);
            if (currentDashboard) {
              const updated = { ...currentDashboard, sessionId: sid };
              setCurrentDashboard(updated);
              window.hermesAPI.dashboards.save(updated.id, updated, profile);
            }
          }}
        />
      </aside>

      {currentDashboard && (
        <button 
          className={`sidebar-toggle ${isSidebarOpen ? "open" : "closed"}`} 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title={isSidebarOpen ? "Hide Chat" : "Show Chat"}
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      )}
      
      {currentDashboard && (
        <main className="dashboard-content">
          <header className="dashboard-header">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-black tracking-tight">{currentDashboard.title}</h1>
            </div>
            
            <div className="dashboard-actions">
              <button className="refresh-btn mr-2" onClick={handleSummarizeDashboard} title="AI Summary of whole Dashboard">
                <Sparkles size={14} className="mr-2 text-dash-accent" />
                AI Summary
              </button>
              <button className="refresh-btn" onClick={handleRefresh}>
                <RefreshCw size={14} className="mr-2" />
                Refresh
              </button>
            </div>
          </header>
          <DashboardGrid 
            ref={gridRef}
            key={refreshKey}
            dashboard={currentDashboard} 
            profile={profile} 
            onSummarizeWidget={handleSummarizeWidget}
          />
        </main>
      )}
    </div>
  );
}
