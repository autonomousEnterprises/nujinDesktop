# Nujin Dashboard Example: Interactive Buttons

This example demonstrates how to trigger Python scripts via user interaction using the `action` and `button_group` widgets.
Action scripts run on demand when the button is clicked.

```json
{
  "id": "system_controls",
  "title": "System Controls",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "quick_actions",
      "type": "button_group",
      "title": "Maintenance",
      "gridSize": "wide",
      "config": {
        "actions": [
          {
            "id": "clear_cache",
            "label": "Clear Cache",
            "scriptPath": "scripts/clear_cache.py",
            "icon": "trash",
            "color": "rose",
            "variant": "outline"
          },
          {
            "id": "sync_data",
            "label": "Sync Data",
            "scriptPath": "scripts/sync_data.py",
            "icon": "activity",
            "color": "blue",
            "variant": "primary"
          }
        ]
      }
    },
    {
      "id": "restart_server",
      "type": "action",
      "title": "Restart Local Server",
      "gridSize": "medium",
      "config": {
        "id": "restart_cmd",
        "label": "Restart",
        "scriptPath": "scripts/restart.py",
        "icon": "activity",
        "color": "amber",
        "variant": "primary"
      }
    }
  ]
}
```
