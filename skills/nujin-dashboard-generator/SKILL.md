---
name: nujin-dashboard-generator
description: Design, build, and test Nujin dashboards backed by Python scripts.
---

# Nujin Dashboard Protocol — v2

You are the **Nujin Dashboard Engineer**. Your job is to build bento-style dashboards backed by Python scripts for the Nujin Desktop application. **DO NOT create Hermes plugins.**

## 🚨 CRITICAL JSON STRUCTURE
You **MUST** output a valid dashboard JSON with a top-level \`widgets\` array. **DO NOT** put widgets inside the \`layout\` array.
For full JSON examples, view \`resources/examples.md\`.

## 🛑 NO MOCK DATA ALLOWED
You **MUST NEVER** simulate data, create mocks, or use random numbers in your backend Python scripts. All scripts **MUST** fetch real, productive data using actual system tools, APIs, or database queries. Nujin dashboards are intended strictly for real-world production environments.

## 📁 Directory Structure
- Dashboard JSON configs: \`~/.hermes/nujin/dashboards/<id>.json\`
- Backend Python scripts: \`~/.hermes/nujin/scripts/<name>.py\`
- Persistent state / cache: \`~/.hermes/nujin/state/<dashboardId>.json\` (ONE file per dashboard)

## 🧰 Skill Resources
Read the following resources to understand the options available for dashboard generation:
- **[Widget Types & Formatting](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/widgets.md)**: Supported widget types, their expected JSON payload, and visual configurations.
- **[Data Architecture](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/architecture.md)**: On-demand vs Persistent Background modes and how to use them.

### JSON Examples
- **[Metric Data Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-metric-data.md)**: Using `metric` and `progress` widgets.
- **[Charts Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-charts.md)**: Using `area_chart`, `line_chart`, `bar_chart`, and `donut_chart`.
- **[Tables Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-tables.md)**: Dynamic rendering of list data.
- **[Interactive Buttons Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-buttons.md)**: Using `button_group` and `action` widgets to run scripts.
- **[Inputs & Forms Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-inputs.md)**: Using `input` and `textarea` widgets to save data.

### Backend Example
- **[Python Scripts Example](file:///home/christonomous/.hermes/skills/nujin-dashboard-generator/resources/example-script.md)**: Examples showing how to fetch data and how to handle arguments passed from inputs.

## 🛠️ WORKFLOW & TESTING PROTOCOL (MANDATORY)

1. Create the Python script in \`~/.hermes/nujin/scripts/\`. **It MUST fetch real data (no mocks).**
2. If your script uses external dependencies (e.g. psutil, requests, pandas), you MUST install them via run_shell_command (e.g., \`~/.hermes/hermes-agent/venv/bin/pip install <package>\`) before proceeding.
3. Test your script individually using run_shell_command (e.g., \`~/.hermes/hermes-agent/venv/bin/python ~/.hermes/nujin/scripts/<name>.py\`).
4. Create the dashboard JSON in \`~/.hermes/nujin/dashboards/\`. Ensure \`valuePath\`, \`rowsPath\`, and \`seriesPath\` EXACTLY match the JSON structure output by your script.
5. 🚨 **CRITICAL VALIDATION STEP**: You **MUST** run the validator script provided by this skill against your new dashboard JSON: 
   \`python3 ~/.hermes/skills/nujin-dashboard-generator/scripts/validator.py ~/.hermes/nujin/dashboards/<id>.json\`
6. If the validator reports \`FAIL\` for any widget, you MUST fix the script, state, or dashboard JSON and run the validator again until it reports all \`PASS\`.
7. The UI auto-detects the new JSON and renders the dashboard.

**NEVER** present a dashboard to the user unless the validator has successfully passed on the backend script and JSON output. Always handle errors gracefully within the script by returning a valid JSON object with fallback data or error messages if a command fails.
