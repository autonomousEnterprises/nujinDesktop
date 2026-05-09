# Nujin Data Architecture

There are two modes for getting data into a Nujin dashboard:

## 1. On-Demand (Default)
The python script prints JSON to **stdout**. The application executes the script every time the dashboard is viewed or refreshed.
- Set widget property: \`"dataSource": "scripts/<name>.py"\`

## 2. Persistent Background (Cron)
Use when the user needs data tracked continuously while the application is closed.
1. The script writes its JSON output to a single file: \`~/.hermes/nujin/state/<dashboardId>.json\` (all widget states for the dashboard must be within this one file)
2. Schedule it: \`hermes cron create "*/5 * * * *" --name "Nujin <name>" -- "~/.hermes/hermes-agent/venv/bin/python ~/.hermes/nujin/scripts/<name>.py"\`
3. Set widget property: \`"dataSource": "state/<key>"\` (NO .json extension — the key refers to the JSON field name inside the state file)
