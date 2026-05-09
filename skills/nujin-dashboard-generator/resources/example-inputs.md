# Nujin Dashboard Example: Inputs & Forms

This example demonstrates how to create interactive inputs and textareas that save data via Python scripts.

## Key Concepts
1. **Initial Value**: The widget's `dataSource` determines its initial value when the dashboard loads.
2. **Passing the Value**: To send the user's input to a script, add `{{value}}` to the action's `scriptPath`. The application detects this and passes the live input text as a secure argument to your Python script.

```json
{
  "id": "user_notes",
  "title": "Quick Notes",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "scratchpad",
      "type": "textarea",
      "title": "Daily Scratchpad",
      "gridSize": "wide",
      "dataSource": "state/scratchpad",
      "config": {
        "placeholder": "Type your notes here...",
        "icon": "FileText"
      },
      "actions": [
        {
          "id": "save_note",
          "label": "Save Note",
          "scriptPath": "scripts/save_note.py {{value}}",
          "variant": "primary"
        },
        {
          "id": "clear_note",
          "label": "Clear",
          "scriptPath": "scripts/clear_note.py",
          "variant": "danger"
        }
      ]
    },
    {
      "id": "quick_search",
      "type": "input",
      "title": "Search System",
      "gridSize": "medium",
      "config": {
        "placeholder": "Search query...",
        "type": "text",
        "icon": "Search"
      },
      "actions": [
        {
          "id": "run_search",
          "label": "Search",
          "scriptPath": "scripts/search.py {{value}}",
          "variant": "primary"
        }
      ]
    }
  ]
}
```
