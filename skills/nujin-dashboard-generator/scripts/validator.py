import sys, json, os, subprocess

def extract_path(data, path):
    if not path: return data
    for key in path.split('.'):
        if isinstance(data, dict) and key in data:
            data = data[key]
        elif isinstance(data, list) and key.isdigit() and int(key) < len(data):
            data = data[int(key)]
        else:
            return None
    return data

def validate():
    if len(sys.argv) < 2:
        print("Usage: python3 validator.py <dashboard_json_path>")
        sys.exit(1)
    
    dash_path = sys.argv[1]
    if not os.path.exists(dash_path):
        print(f"FAIL: Dashboard not found at {dash_path}")
        sys.exit(1)

    try:
        with open(dash_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except Exception as e:
        print(f"FAIL: Invalid JSON in dashboard file: {e}")
        sys.exit(1)

    print(f"Validating Dashboard: {config.get('title', 'Unknown')} ({config.get('id', 'unknown')})")

    hermes_home = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(dash_path))))
    if not hermes_home.endswith(".hermes"):
        hermes_home = os.path.expanduser("~/.hermes")

    dashboard_id = config.get("id")

    widgets = config.get("widgets", [])
    if not widgets:
        print("WARN: No widgets found in dashboard.")
    
    all_passed = True

    for w in widgets:
        w_id = w.get("id", "unknown")
        print(f"\\n--- Widget: {w_id} ({w.get('type')}) ---")
        
        data_source = w.get("dataSource")
        if not data_source:
            print("INFO: No dataSource, skipping data extraction check.")
            continue
        
        data = None
        if data_source.startswith("scripts/") or data_source.endswith(".py"):
            script_rel = data_source.split(" ")[0]
            script_full = os.path.join(hermes_home, "nujin", script_rel)
            if not os.path.exists(script_full):
                print(f"FAIL: Script not found: {script_full}")
                all_passed = False
                continue
            
            try:
                # Resolve hermes venv python if available
                venv_python = os.path.join(hermes_home, "hermes-agent", "venv", "bin", "python")
                python_bin = venv_python if os.path.exists(venv_python) else "python3"
                cmd = [python_bin, script_full] + data_source.split(" ")[1:]
                res = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.join(hermes_home, "nujin"))
                if res.returncode != 0:
                    print(f"FAIL: Script exited with {res.returncode}\\nSTDERR: {res.stderr.strip()}")
                    all_passed = False
                    continue
                data = json.loads(res.stdout)
            except Exception as e:
                print(f"FAIL: Script execution or JSON parsing failed: {e}\\nSTDOUT: {res.stdout.strip() if 'res' in locals() else ''}")
                all_passed = False
                continue
        
        elif data_source.startswith("state/") and not data_source.endswith(".py"):
            state_key = data_source[len("state/"):]
            state_file = os.path.join(hermes_home, "nujin", "state", f"{dashboard_id}.json")
            if not os.path.exists(state_file):
                print(f"WARN: State file not found yet ({state_file}). Skipping value verification.")
                continue
            try:
                with open(state_file, "r", encoding="utf-8") as f:
                    state_data = json.load(f)
                data = {state_key: state_data.get(state_key, "")}
            except Exception as e:
                print(f"FAIL: Could not read state file: {e}")
                all_passed = False
                continue

        w_config = w.get("config", {})
        # Check standard paths
        paths_to_check = []
        if "valuePath" in w_config: paths_to_check.append(("valuePath", w_config["valuePath"]))
        if "rowsPath" in w_config: paths_to_check.append(("rowsPath", w_config["rowsPath"]))
        if "seriesPath" in w_config: paths_to_check.append(("seriesPath", w_config["seriesPath"]))

        if not paths_to_check:
            print("INFO: No path configuration (valuePath/rowsPath/seriesPath) to check.")
            continue

        for p_name, p_val in paths_to_check:
            extracted = extract_path(data, p_val)
            if extracted is None:
                print(f"FAIL: {p_name} '{p_val}' did not match any data in the resolved output.")
                all_passed = False
            else:
                print(f"PASS: {p_name} '{p_val}' resolved successfully (Type: {type(extracted).__name__}).")

    print("\\n===========================================")
    if all_passed:
        print("✅ VALIDATION SUCCESSFUL")
    else:
        print("❌ VALIDATION FAILED: See errors above.")

if __name__ == "__main__":
    validate()
