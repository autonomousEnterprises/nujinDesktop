# Nujin Dashboard Example: Python Scripts

This resource demonstrates how to write the backend Python scripts that power your Nujin dashboard widgets.

## Key Concepts
- Scripts should output exactly one valid JSON string to `stdout`.
- Any error messages should be printed to `stderr`, or returned inside the JSON payload using `{"error": "message"}` so the UI can display it gracefully.
- Arguments passed from inputs/buttons are accessed via `sys.argv`.

## 1. On-Demand Script (Data Fetching)

This is a typical script that fetches data and outputs JSON for the dashboard to render.

```python
import sys
import json
import time

def get_system_data():
    try:
        # Fetch real system data using psutil
        import psutil
        
        processes = []
        for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
            try:
                processes.append({
                    "pid": p.info['pid'],
                    "name": p.info['name'],
                    "cpu_percent": p.info['cpu_percent'],
                    "rss_bytes": p.info['memory_info'].rss
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
                
        # Sort by CPU usage and take top 5
        processes = sorted(processes, key=lambda x: x['cpu_percent'] or 0, reverse=True)[:5]
        
        data = {
            "cpu": {
                "total_percent": psutil.cpu_percent(interval=0.1),
                "cores": psutil.cpu_count()
            },
            "processes": processes
        }
        
        # Output valid JSON to stdout
        print(json.dumps(data))
        
    except Exception as e:
        # Fallback to an error object if something fails
        print(json.dumps({"error": "Failed to fetch system data", "details": str(e)}))

if __name__ == "__main__":
    get_system_data()
```

## 2. Interactive Script (Handling Inputs)

When a button or input action triggers a script, it passes the value as a command-line argument.

```python
import sys
import json
import os

def save_note():
    # sys.argv[0] is the script name.
    # sys.argv[1] is the profile name injected by the Nujin runtime.
    # sys.argv[2] is the input value passed from the UI (if {{value}} was used).
    
    if len(sys.argv) < 3:
        print(json.dumps({"error": "No input provided."}))
        return

    note_content = sys.argv[2]
    
    try:
        # Ensure state directory exists
        state_dir = os.path.expanduser("~/.hermes/nujin/state")
        os.makedirs(state_dir, exist_ok=True)
        
        state_file = os.path.join(state_dir, "scratchpad.json")
        
        # Load existing state
        state = {}
        if os.path.exists(state_file):
            with open(state_file, "r") as f:
                state = json.load(f)
                
        # Update the specific key
        state["scratchpad"] = note_content
        
        # Save back to file
        with open(state_file, "w") as f:
            json.dump(state, f)
            
        # Return success (Nujin UI will show a brief success state on the button)
        print(json.dumps({"success": True}))
        
    except Exception as e:
        print(json.dumps({"error": "Failed to save note", "details": str(e)}))

if __name__ == "__main__":
    save_note()
```
