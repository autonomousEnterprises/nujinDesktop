# Nujin Dashboard Example: Tables

This example demonstrates how to render dynamic lists of data using the `table` widget.

```json
{
  "id": "active_processes",
  "title": "Process Manager",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "procs",
      "type": "table",
      "title": "Top Processes",
      "gridSize": "full",
      "dataSource": "scripts/sysmon.py",
      "refreshInterval": 5,
      "config": {
        "rowsPath": "processes",
        "columns": ["pid", "name", "cpu_percent", "rss_bytes"]
      }
    }
  ]
}
```
