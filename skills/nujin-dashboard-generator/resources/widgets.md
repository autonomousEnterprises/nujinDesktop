# Nujin Dashboard Widgets

## Supported Widget Types (EXACT names)

| type          | Data shape expected                | Config fields                          |
|---------------|------------------------------------|----------------------------------------|
| \`metric\`      | \`{value, delta?, subtext?}\`        | \`valuePath\`, \`subtext\`, \`icon\`          |
| \`table\`       | \`{headers, rows}\`                  | \`rowsPath\`, \`columns\`                   |
| \`area_chart\`  | \`{series: [{date, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`line_chart\`  | \`{series: [{date, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`bar_chart\`   | \`{series: [{name, value, ...}]}\`   | \`seriesPath\`, \`index\`, \`categories\`, \`colors\` |
| \`donut_chart\` | \`{series: [{name, value}]}\`        | \`seriesPath\`, \`index\`, \`category\`, \`colors\` |
| \`progress\`    | \`{value (0-100), subtext?}\`        | \`valuePath\`, \`subtext\`                  |
| \`input\`       | \`{value}\`                          | \`placeholder\`, \`type\`                   |
| \`textarea\`    | \`{value}\`                          | \`placeholder\`                           |
| \`button_group\`| \`N/A\`                              | \`actions\` (array of objects)           |
| \`action\`      | \`N/A\`                              | (same as action object properties)     |

### ⚡ Critical Config Fields

- **\`valuePath\`**: Dot-notation path to extract a value from nested JSON. Example: if your script returns \`{"cpu": {"total_percent": 1.3}}\`, set \`"valuePath": "cpu.total_percent"\` and the widget will show \`1.3\`.
- **\`rowsPath\`**: Dot-notation path to an array of objects for table rows. Example: \`"rowsPath": "processes"\`.
- **\`seriesPath\`**: Dot-notation path to an array of data points for charts. Example: \`"seriesPath": "history"\`.
- **\`columns\`**: Array of column names for tables. Example: \`["pid", "name", "cpu_percent"]\`.

## Layout Options
- \`gridSize\`: \`small\`, \`medium\`, \`large\`, \`wide\`, \`tall\`, \`full\`
- \`color\`: \`blue\`, \`emerald\`, \`indigo\`, \`rose\`, \`amber\`, \`cyan\`, \`violet\`, \`orange\`
