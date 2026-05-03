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
      return "col-span-1 md:col-span-1 lg:col-span-1 row-span-1";
    case "wide":
      return "col-span-1 md:col-span-2 lg:col-span-2 row-span-1";
    case "tall":
      return "col-span-1 row-span-2";
    case "large":
      return "col-span-1 md:col-span-2 lg:col-span-2 row-span-2";
    case "full":
      return "col-span-full";
    default:
      return "col-span-1 row-span-1";
  }
};

export default function DashboardGrid({ dashboard, profile }: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[240px] gap-8 p-1 pb-10">
      {dashboard.widgets.map((widget) => (
        <div 
          key={widget.id} 
          className={`${getGridClasses(widget.gridSize)} transition-all duration-700 ease-in-out`}
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
