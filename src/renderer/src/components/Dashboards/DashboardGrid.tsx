import WidgetRenderer from "./WidgetRenderer";
import { DashboardConfig } from "../../../../main/dashboards";

interface DashboardGridProps {
  dashboard: DashboardConfig;
  profile: string;
}

const getWidthClasses = (widget: any) => {
  const size = (widget.gridSize || "medium").toLowerCase();
  
  switch (size) {
    case "small":
      return "col-span-1";
    case "medium":
      return "col-span-1";
    case "wide":
      return "col-span-1 @min-[800px]:col-span-2";
    case "large":
      return "col-span-1 @min-[800px]:col-span-2";
    case "massive":
      return "col-span-1 @min-[800px]:col-span-2";
    case "hero":
      return "col-span-1 @min-[800px]:col-span-2";
    case "full":
      return "col-span-full";
    default:
      return "col-span-1";
  }
};

export default function DashboardGrid({ dashboard, profile }: DashboardGridProps) {
  return (
    <div className="@container/dashboard-grid grid grid-cols-1 @min-[600px]:grid-cols-2 @min-[1100px]:grid-cols-3 @min-[1400px]:grid-cols-4 gap-6 md:gap-8 p-1 pb-10 items-start">
      {dashboard.widgets.map((widget) => {
        const widthClass = getWidthClasses(widget);
        
        return (
          <div 
            key={widget.id} 
            className={`${widthClass} h-fit`}
          >
            <WidgetRenderer 
              widget={widget} 
              dashboardId={dashboard.id}
              profile={profile} 
            />
          </div>
        );
      })}
    </div>
  );
}
