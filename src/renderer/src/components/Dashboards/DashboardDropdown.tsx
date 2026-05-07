import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus, Trash2 } from "lucide-react";

interface DashboardDropdownProps {
  currentId: string;
  dashboardList: string[];
  onSwitch: (id: string) => void;
  onDelete?: (id: string) => void;
  label?: string;
}

export default function DashboardDropdown({
  currentId,
  dashboardList,
  onSwitch,
  onDelete,
  label = "CONFIGURATOR"
}: DashboardDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatId = (id: string) => {
    if (!id || id === "new_dashboard") return "New Dashboard";
    return id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const currentTitle = currentId ? formatId(currentId) : "New Dashboard";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-flex items-center gap-2" ref={containerRef}>
      <span className="text-accent font-black tracking-tighter text-xs opacity-70">{label}</span>
      <span className="opacity-20 select-none">/</span>
      
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-300
            text-sm font-bold tracking-tight
            ${isOpen 
              ? 'bg-accent text-white shadow-lg shadow-accent/20 scale-[1.02]' 
              : 'bg-elevated text-primary hover:bg-hover border border-border-bright shadow-sm'}
          `}
        >
          <span className="truncate max-w-[180px]">{currentTitle}</span>
          <ChevronDown 
            size={14} 
            className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {isOpen && (
          <div 
            className="
              absolute top-full left-0 mt-2 min-w-[220px] z-[100]
              bg-elevated border border-border-bright
              rounded-2xl shadow-2xl overflow-hidden
              animate-in fade-in zoom-in-95 duration-200
            "
          >
            <div className="p-1.5 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => {
                  onSwitch("");
                  setIsOpen(false);
                }}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${!currentId || currentId === "new_dashboard" 
                    ? 'bg-accent/10 text-accent' 
                    : 'text-secondary hover:bg-hover hover:text-primary'}
                `}
              >
                <div className="flex items-center gap-2">
                  <Plus size={14} className="opacity-60" />
                  <span>New Dashboard</span>
                </div>
                {(!currentId || currentId === "new_dashboard") && <Check size={14} />}
              </button>

              <div className="h-px bg-border-bright my-1 mx-2" />

              {dashboardList.map(id => {
                const isActive = currentId === id;
                return (
                  <div
                    key={id}
                    className={`
                      flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-200 group
                      ${isActive 
                        ? 'bg-accent/10 text-accent' 
                        : 'text-secondary hover:bg-hover hover:text-primary'}
                    `}
                    onClick={() => {
                      onSwitch(id);
                      setIsOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{formatId(id)}</span>
                      <div className="flex items-center gap-1">
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete "${formatId(id)}"?`)) {
                                onDelete(id);
                              }
                            }}
                            className="p-1.5 rounded-lg hover:bg-rose-500/20 text-rose-500 opacity-0 group-hover:opacity-100 transition-all duration-200"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        {isActive && <Check size={14} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
