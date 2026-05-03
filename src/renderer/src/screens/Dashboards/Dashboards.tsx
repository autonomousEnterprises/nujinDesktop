import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import Chat, { ChatMessage } from "../Chat/Chat";
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

  // Load dashboards on mount
  useEffect(() => {
    loadDashboardList().then((list) => {
      if (list.length > 0 && !currentDashboard) {
        window.hermesAPI.dashboards.get(list[0], profile).then(setCurrentDashboard);
      }
    });
  }, [profile, loadDashboardList]);

  // Sync chat when dashboard changes
  useEffect(() => {
    if (currentDashboard) {
      const savedMessages = dashboardChats[currentDashboard.id] || [];
      const savedSession = dashboardSessions[currentDashboard.id] || null;
      setMessages(savedMessages);
      setCurrentSessionId(savedSession);
    }
  }, [currentDashboard?.id]);

  // Update persistence when messages or sessionId change
  useEffect(() => {
    if (currentDashboard) {
      setDashboardChats(prev => ({ ...prev, [currentDashboard.id]: messages }));
      setDashboardSessions(prev => ({ ...prev, [currentDashboard.id]: currentSessionId }));
    }
  }, [messages, currentSessionId]);

  const switchDashboard = async (id: string) => {
    const config = await window.hermesAPI.dashboards.get(id, profile);
    if (config) {
      setCurrentDashboard(config);
    }
  };

  // Listen for updates from Hermes background scripts
  useEffect(() => {
    const cleanup = window.hermesAPI.dashboards.onUpdate((filename) => {
      loadDashboardList();
      if (currentDashboard && filename.startsWith(currentDashboard.id)) {
        window.hermesAPI.dashboards.get(currentDashboard.id, profile).then(setCurrentDashboard);
      }
    });
    return cleanup;
  }, [currentDashboard, profile, loadDashboardList]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentSessionId(null);
  }, []);

  return (
    <div className={`dashboards-screen ${currentDashboard ? "split-view" : "full-chat"}`}>
      <aside className={`chat-sidebar ${isSidebarOpen ? "open" : "closed"}`}>
        <Chat
          messages={messages}
          setMessages={setMessages}
          profile={profile}
          onNewChat={handleNewChat}
          compact={!!currentDashboard}
          dashboardContext={currentDashboard || undefined}
          sessionId={currentSessionId}
          onSessionStarted={(sid) => setCurrentSessionId(sid)}
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
              <div className="relative group">
                <select 
                  className="appearance-none bg-secondary/50 border border-border rounded-xl px-4 py-2 pr-10 text-sm font-bold cursor-pointer hover:bg-secondary transition-colors"
                  value={currentDashboard.id}
                  onChange={(e) => switchDashboard(e.target.value)}
                >
                  {dashboardList.map(id => (
                    <option key={id} value={id}>{id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                   <ChevronRight size={14} className="rotate-90" />
                </div>
              </div>
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
