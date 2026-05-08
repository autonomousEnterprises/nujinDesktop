import { useState, useCallback, useEffect } from "react";
import Chat, { ChatMessage } from "../Chat/Chat";
import Sessions from "../Sessions/Sessions";
import Agents from "../Agents/Agents";
import Settings from "../Settings/Settings";
import Skills from "../Skills/Skills";
import Soul from "../Soul/Soul";
import Memory from "../Memory/Memory";
import Tools from "../Tools/Tools";
import Gateway from "../Gateway/Gateway";
import Office from "../Office/Office";
import Models from "../Models/Models";
import Providers from "../Providers/Providers";
import Schedules from "../Schedules/Schedules";
import Dashboards from "../Dashboards/Dashboards";
import RemoteNotice from "../../components/RemoteNotice";

import {
  ChatBubble,
  Clock,
  Users,
  Settings as SettingsIcon,
  Puzzle,
  Sparkles,
  Brain,
  Wrench,
  Signal,
  Building,
  Layers,
  KeyRound,
  Timer,
  Download,
  DashboardIcon,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../components/useI18n";

type View =
  | "chat"
  | "dashboards"
  | "sessions"
  | "agents"
  | "office"
  | "models"
  | "providers"
  | "skills"
  | "soul"
  | "memory"
  | "tools"
  | "schedules"
  | "gateway"
  | "settings";

const NAV_ITEMS: { view: View; icon: LucideIcon; labelKey: string }[] = [
  { view: "chat", icon: ChatBubble, labelKey: "navigation.chat" },
  { view: "dashboards", icon: DashboardIcon, labelKey: "navigation.dashboards" },
  { view: "sessions", icon: Clock, labelKey: "navigation.sessions" },
  { view: "agents", icon: Users, labelKey: "navigation.agents" },
  { view: "office", icon: Building, labelKey: "navigation.office" },
  { view: "models", icon: Layers, labelKey: "navigation.models" },
  { view: "providers", icon: KeyRound, labelKey: "navigation.providers" },
  { view: "skills", icon: Puzzle, labelKey: "navigation.skills" },
  { view: "soul", icon: Sparkles, labelKey: "navigation.soul" },
  { view: "memory", icon: Brain, labelKey: "navigation.memory" },
  { view: "tools", icon: Wrench, labelKey: "navigation.tools" },
  { view: "schedules", icon: Timer, labelKey: "navigation.schedules" },
  { view: "gateway", icon: Signal, labelKey: "navigation.gateway" },
  { view: "settings", icon: SettingsIcon, labelKey: "navigation.settings" },
];

function Layout(): React.JSX.Element {
  const { t } = useI18n();
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState("default");
  // Lazy mount: only render Office after first visit, then keep mounted
  const [officeVisited, setOfficeVisited] = useState(false);
  // Remote mode — many screens show "not available" instead of empty data
  const [remoteMode, setRemoteMode] = useState(false);

  // Dashboards state
  const [dashboardList, setDashboardList] = useState<string[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null);
  const [isDashboardsExpanded, setIsDashboardsExpanded] = useState(true);

  const loadDashboardList = useCallback(async () => {
    const list = await window.hermesAPI.dashboards.list(activeProfile);
    setDashboardList(list);
  }, [activeProfile]);

  useEffect(() => {
    loadDashboardList();
    const cleanup = window.hermesAPI.dashboards.onUpdate(() => {
      loadDashboardList();
    });
    return cleanup;
  }, [loadDashboardList]);

  // Re-check remote mode on tab switch (picks up Settings changes)
  useEffect(() => {
    window.hermesAPI.isRemoteMode().then(setRemoteMode);
  }, [view]);

  // Auto-update state
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<
    "available" | "downloading" | "ready" | null
  >(null);
  const [downloadPercent, setDownloadPercent] = useState(0);

  useEffect(() => {
    const cleanupAvailable = window.hermesAPI.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState("available");
    });
    const cleanupProgress = window.hermesAPI.onUpdateDownloadProgress(
      (info) => {
        setDownloadPercent(info.percent);
      },
    );
    const cleanupDownloaded = window.hermesAPI.onUpdateDownloaded(() => {
      setUpdateState("ready");
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
    };
  }, []);

  async function handleUpdate(): Promise<void> {
    if (updateState === "available") {
      setUpdateState("downloading");
      await window.hermesAPI.downloadUpdate();
    } else if (updateState === "ready") {
      await window.hermesAPI.installUpdate();
    }
  }

  const handleNewChat = useCallback(() => {
    // Abort any in-flight chat before clearing
    window.hermesAPI.abortChat();
    setMessages([]);
    setCurrentSessionId(null);
    setView("chat");
  }, []);

  // Listen for menu IPC events (Cmd+N, Cmd+K from app menu)
  useEffect(() => {
    const cleanupNewChat = window.hermesAPI.onMenuNewChat(() => {
      handleNewChat();
    });
    const cleanupSearch = window.hermesAPI.onMenuSearchSessions(() => {
      setView("sessions");
    });
    return () => {
      cleanupNewChat();
      cleanupSearch();
    };
  }, [handleNewChat]);

  const handleSwitchDashboard = useCallback((id: string | null) => {
    setSelectedDashboardId(id);
    if (id) setView("dashboards");
  }, []);

  const handleDeleteDashboard = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete the dashboard "${id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}"?`)) {
      return;
    }
    console.log(`[Layout] Deleting dashboard: ${id}`);
    const success = await window.hermesAPI.dashboards.delete(id, activeProfile);
    console.log(`[Layout] Deletion success: ${success}`);
    if (success) {
      // 1. Small delay to ensure FS is settled
      await new Promise(r => setTimeout(r, 100));
      // 2. Refresh local list
      await loadDashboardList();
      // 3. Clear selection if needed
      if (selectedDashboardId === id) {
        setSelectedDashboardId(null);
      }
    } else {
      alert("Failed to delete dashboard. Check logs for details.");
    }
  }, [selectedDashboardId, activeProfile, loadDashboardList]);

  const handleSelectProfile = useCallback((name: string) => {
    setActiveProfile(name);
    setMessages([]);
    setCurrentSessionId(null);
  }, []);

  const handleResumeSession = useCallback(async (sessionId: string) => {
    // 1. Try to find a dashboard associated with this session
    const dashboards = await window.hermesAPI.dashboards.list(activeProfile);
    let foundDashboardId: string | null = null;
    
    for (const id of dashboards) {
      const config = await window.hermesAPI.dashboards.get(id, activeProfile);
      if (config && config.sessionId === sessionId) {
        foundDashboardId = id;
        break;
      }
    }

    if (foundDashboardId) {
      // It's a dashboard session - switch to dashboards view
      setSelectedDashboardId(foundDashboardId);
      setView("dashboards");
    } else {
      // It's a normal chat session - load messages and switch to chat view
      const dbMessages = await window.hermesAPI.getSessionMessages(sessionId);
      const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
        id: `db-${m.id}`,
        role: m.role === "user" ? "user" : "agent",
        content: m.content,
      }));
      setMessages(chatMessages);
      setCurrentSessionId(sessionId);
      setView("chat");
    }
  }, [activeProfile]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1 className="sidebar-brand-text">
            Nujin <span className="text-gradient">AI</span>
          </h1>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ view: v, icon: Icon, labelKey }) => (
            <div key={v} className="sidebar-nav-group">
              <div className={`sidebar-nav-item-wrapper ${view === v ? "active" : ""}`}>
                <button
                  className="sidebar-nav-item"
                  onClick={() => {
                    if (v === "office") setOfficeVisited(true);
                    setView(v);
                  }}
                >
                  <Icon size={16} />
                  {t(labelKey)}
                </button>
                {v === "dashboards" && (
                  <button 
                    className="sidebar-nav-expand"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDashboardsExpanded(!isDashboardsExpanded);
                    }}
                  >
                    {isDashboardsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                )}
              </div>
              
              {v === "dashboards" && isDashboardsExpanded && (
                <div className="sidebar-sub-nav">
                  <button 
                    className={`sidebar-sub-nav-item ${!selectedDashboardId ? "active" : ""}`}
                    onClick={() => {
                      setSelectedDashboardId(null);
                      setView("dashboards");
                    }}
                  >
                    <Plus size={12} />
                    <span>New Dashboard</span>
                  </button>
                   {dashboardList.map(id => (
                    <div 
                      key={id}
                      className={`sidebar-sub-nav-item group/item ${selectedDashboardId === id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedDashboardId(id);
                        setView("dashboards");
                      }}
                    >
                      <span className="flex-1 truncate">
                        {id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                      <button
                        className="p-1 opacity-0 group-hover/item:opacity-100 hover:text-red-500 transition-all"
                        onClick={(e) => handleDeleteDashboard(e, id)}
                        title="Delete Dashboard"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {updateState && (
            <button className="sidebar-update-btn" onClick={handleUpdate}>
              <Download size={13} />
              {updateState === "available" && (
                <span>
                  {t("common.updateAvailable", { version: updateVersion })}
                </span>
              )}
              {updateState === "downloading" && (
                <span>
                  {t("common.downloading", { percent: downloadPercent })}
                </span>
              )}
              {updateState === "ready" && (
                <span>{t("common.restartToUpdate")}</span>
              )}
            </button>
          )}
          <div className="sidebar-footer-text">
            {activeProfile === "default" ? t("common.appName") : activeProfile}
          </div>
        </div>
      </aside>

      <main className="content">
        <div
          style={{
            display: view === "chat" ? "flex" : "none",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Chat
            messages={messages}
            setMessages={setMessages}
            sessionId={currentSessionId}
            profile={activeProfile}
            onNewChat={handleNewChat}
          />
        </div>
        {view === "dashboards" && (
          <Dashboards 
            profile={activeProfile} 
            selectedDashboardId={selectedDashboardId}
            onDashboardSelected={setSelectedDashboardId}
          />
        )}
        {view === "sessions" &&
          (remoteMode ? (
            <RemoteNotice feature="Sessions" />
          ) : (
            <Sessions
              onResumeSession={handleResumeSession}
              onNewChat={handleNewChat}
              currentSessionId={currentSessionId}
            />
          ))}
        {view === "agents" &&
          (remoteMode ? (
            <RemoteNotice feature="Profiles" />
          ) : (
            <Agents
              activeProfile={activeProfile}
              onSelectProfile={handleSelectProfile}
              onChatWith={(name: string) => {
                handleSelectProfile(name);
                setView("chat");
              }}
            />
          ))}
        {officeVisited && (
          <div
            style={{
              display: view === "office" ? "flex" : "none",
              flex: 1,
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Office visible={view === "office"} />
          </div>
        )}
        {view === "models" && <Models />}
        <div
          style={{
            display: view === "providers" ? "flex" : "none",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {remoteMode ? (
            view === "providers" && <RemoteNotice feature="Providers" />
          ) : (
            <Providers profile={activeProfile} visible={view === "providers"} />
          )}
        </div>
        {view === "skills" &&
          (remoteMode ? (
            <RemoteNotice feature="Skills" />
          ) : (
            <Skills profile={activeProfile} />
          ))}
        {view === "soul" &&
          (remoteMode ? (
            <RemoteNotice feature="Persona" />
          ) : (
            <Soul profile={activeProfile} />
          ))}
        {view === "memory" &&
          (remoteMode ? (
            <RemoteNotice feature="Memory" />
          ) : (
            <Memory profile={activeProfile} />
          ))}
        {view === "tools" &&
          (remoteMode ? (
            <RemoteNotice feature="Tools" />
          ) : (
            <Tools profile={activeProfile} />
          ))}
        {view === "schedules" &&
          (remoteMode ? (
            <RemoteNotice feature="Schedules" />
          ) : (
            <Schedules profile={activeProfile} />
          ))}
        {view === "gateway" &&
          (remoteMode ? (
            <RemoteNotice feature="Gateway" />
          ) : (
            <Gateway profile={activeProfile} />
          ))}
        <div
          style={{
            display: view === "settings" ? "flex" : "none",
            flex: 1,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Settings profile={activeProfile} />
        </div>
      </main>
    </div>
  );
}

export default Layout;
