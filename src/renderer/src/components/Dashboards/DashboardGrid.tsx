import WidgetRenderer from "./WidgetRenderer";
import { DashboardConfig } from "../../../../main/dashboards";

interface DashboardGridProps {
  dashboard: DashboardConfig;
  profile: string;
}

const getGridClasses = (gridSize: string = "medium") => {
  const size = gridSize.toLowerCase();
  switch (size) {
    case "small":
      return "col-span-1 row-span-1";
    case "medium":
      return "col-span-1 row-span-1";
    case "wide":
      return "col-span-1 @min-[800px]:col-span-2 row-span-1";
    case "tall":
      return "col-span-1 row-span-2";
    case "large":
      return "col-span-1 @min-[800px]:col-span-2 row-span-2";
    case "full":
      return "col-span-full";
    default:
      return "col-span-1 row-span-1";
  }
};

export default function DashboardGrid({ dashboard, profile }: DashboardGridProps) {
  return (
    <div className="@container/dashboard-grid grid grid-cols-1 @min-[600px]:grid-cols-2 @min-[1100px]:grid-cols-3 @min-[1400px]:grid-cols-4 auto-rows-[240px] gap-6 md:gap-8 p-1 pb-10">
      {dashboard.widgets.map((widget) => (
        <div 
          key={widget.id} 
          className={`${getGridClasses(widget.gridSize)} transition-all duration-500 ease-in-out`}
        >
          <WidgetRenderer 
            widget={widget} 
            dashboardId={dashboard.id}
            profile={profile} 
          />
        </div>
      ))}
    </div>
  );
}
