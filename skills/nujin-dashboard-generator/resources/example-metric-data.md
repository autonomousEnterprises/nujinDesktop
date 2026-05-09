# Nujin Dashboard Example: Metric Data

This example demonstrates how to create a simple dashboard displaying key metric values using the `metric` and `progress` widgets.

```json
{
  "id": "system_metrics",
  "title": "System Metrics",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "cpu_metric",
      "type": "metric",
      "title": "CPU Usage",
      "gridSize": "medium",
      "color": "blue",
      "dataSource": "scripts/sysmon.py",
      "refreshInterval": 10,
      "config": {
        "valuePath": "cpu.total_percent",
        "subtext": "Live CPU Usage",
        "format": "percent"
      }
    },
    {
      "id": "ram_metric",
      "type": "metric",
      "title": "Available RAM",
      "gridSize": "medium",
      "color": "emerald",
      "dataSource": "scripts/sysmon.py",
      "refreshInterval": 10,
      "config": {
        "valuePath": "memory.available_gb",
        "subtext": "GB Available",
        "format": "number"
      }
    },
    {
      "id": "disk_progress",
      "type": "progress",
      "title": "Disk Space Used",
      "gridSize": "wide",
      "color": "rose",
      "dataSource": "scripts/sysmon.py",
      "refreshInterval": 60,
      "config": {
        "valuePath": "disk.used_percent",
        "subtext": "Root Partition"
      }
    }
  ]
}
```
