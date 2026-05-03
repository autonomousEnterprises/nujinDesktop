import { useState, useEffect, useCallback } from "react";
import Chat, { ChatMessage } from "../Chat/Chat";
import DashboardGrid from "../../components/Dashboards/DashboardGrid";
import { DashboardConfig } from "../../../../main/dashboards";
import "./Dashboards.css";

interface DashboardsProps {
  profile: string;
}

export default function Dashboards({ profile }: DashboardsProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardConfig | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Load latest dashboard for the current session or profile
  useEffect(() => {
    const loadDashboards = async () => {
      const list = await window.hermesAPI.dashboards.list(profile);
      if (list.length > 0) {
        // For now, load the first one or a "current" one
        const config = await window.hermesAPI.dashboards.get(list[0], profile);
        setCurrentDashboard(config);
      }
    };
    loadDashboards();
  }, [profile]);

  // Listen for updates from Hermes background scripts
  useEffect(() => {
    const cleanup = window.hermesAPI.dashboards.onUpdate((filename) => {
      if (currentDashboard && filename.startsWith(currentDashboard.id)) {
        // Refresh dashboard config if it changed
        window.hermesAPI.dashboards.get(currentDashboard.id, profile).then(setCurrentDashboard);
      }
    });
    return cleanup;
  }, [currentDashboard, profile]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setCurrentDashboard(null);
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
        />
        {currentDashboard && (
          <button 
            className="sidebar-toggle" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? "←" : "→"}
          </button>
        )}
      </aside>
      
      {currentDashboard && (
        <main className="dashboard-content">
          <header className="dashboard-header">
            <h1>{currentDashboard.title}</h1>
            <div className="dashboard-actions">
              <button onClick={() => window.hermesAPI.dashboards.get(currentDashboard.id, profile).then(setCurrentDashboard)}>
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
