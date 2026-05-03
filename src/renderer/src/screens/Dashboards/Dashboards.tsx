import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import DashboardChat from "./DashboardChat";
import { ChatMessage } from "../Chat/Chat";
import DashboardGrid from "../../components/Dashboards/DashboardGrid";
import { DashboardConfig } from "../../../../main/dashboards";
import "./Dashboards.css";

interface DashboardsProps {
  profile: string;
}

export default function Dashboards({ profile }: DashboardsProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | null>(null);
  const [dashboardList, setDashboardList] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Persistence for chats per dashboard
  const [dashboardChats, setDashboardChats] = useState<Record<string, ChatMessage[]>>({});
  const [dashboardSessions, setDashboardSessions] = useState<Record<string, string | null>>({});

  const loadDashboardList = useCallback(async () => {
    const list = await window.hermesAPI.dashboards.list(profile);
    setDashboardList(list);
    return list;
  }, [profile]);

  // Load dashboards on mount but do NOT auto-select, leaving a blank configurator
  useEffect(() => {
    loadDashboardList();
  }, [loadDashboardList]);

  // Sync chat when dashboard changes
  useEffect(() => {
    const key = currentDashboard ? currentDashboard.id : "new_dashboard";
    const savedMessages = dashboardChats[key] || [];
    const savedSession = dashboardSessions[key] || null;
    setMessages(savedMessages);
    setCurrentSessionId(savedSession);
  }, [currentDashboard?.id]);

  // Update persistence when messages or sessionId change
  useEffect(() => {
    const key = currentDashboard ? currentDashboard.id : "new_dashboard";
    setDashboardChats(prev => ({ ...prev, [key]: messages }));
    setDashboardSessions(prev => ({ ...prev, [key]: currentSessionId }));
  }, [messages, currentSessionId]);

  const switchDashboard = async (id: string) => {
    if (!id) {
      setCurrentDashboard(null);
      return;
    }
    const config = await window.hermesAPI.dashboards.get(id, profile);
    if (config) {
      setCurrentDashboard(config);
      
      // If the dashboard has a saved session and we don't have it loaded in memory, fetch it
      if (config.sessionId && !dashboardChats[config.id]) {
        try {
          const dbMessages = await window.hermesAPI.getSessionMessages(config.sessionId);
          const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
            id: `db-${m.id}`,
            role: m.role === "user" ? "user" : "agent",
            content: m.content,
          }));
          setDashboardChats(prev => ({ ...prev, [config.id]: chatMessages }));
          setDashboardSessions(prev => ({ ...prev, [config.id]: config.sessionId! }));
          setMessages(chatMessages);
          setCurrentSessionId(config.sessionId);
        } catch (err) {
          console.error("Failed to fetch session messages for dashboard", err);
        }
      }
    }
  };

  // Listen for updates from Hermes background scripts or new dashboard creations
  useEffect(() => {
    const cleanup = window.hermesAPI.dashboards.onUpdate((filename) => {
      loadDashboardList().then(list => {
        // If we are in the blank state and a new dashboard appears, auto-select it!
        if (!currentDashboard && list.length > 0) {
          const newId = filename.replace(".json", "");
          window.hermesAPI.dashboards.get(newId, profile).then(config => {
            // Bind the active session to the newly created dashboard
            if (config && currentSessionId && !config.sessionId) {
              const updated = { ...config, sessionId: currentSessionId };
              window.hermesAPI.dashboards.save(newId, updated, profile);
              switchDashboard(newId);
            } else {
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
  }, []);

  return (
    <div className={`dashboards-screen ${currentDashboard ? "split-view" : "full-chat"}`}>
      <aside className={`chat-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <DashboardChat
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
          dashboardList={dashboardList}
          onSwitchDashboard={switchDashboard}
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
              <button className="refresh-btn" onClick={() => window.hermesAPI.dashboards.get(currentDashboard.id, profile).then(setCurrentDashboard)}>
                <RefreshCw size={14} className="mr-2" />
                Refresh
              </button>
            </div>
          </header>
          <DashboardGrid dashboard={currentDashboard} profile={profile} />
        </main>
      )}
    </div>
  );
}
