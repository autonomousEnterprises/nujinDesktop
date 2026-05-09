# Nujin Dashboard Example: Charts

This example demonstrates how to create data visualizations using `area_chart`, `line_chart`, `bar_chart`, and `donut_chart`.

```json
{
  "id": "crypto_charts",
  "title": "Crypto Market Analysis",
  "layout": {"type": "grid", "columns": 12, "gap": "lg"},
  "widgets": [
    {
      "id": "price_history",
      "type": "area_chart",
      "title": "BTC Price (7 Days)",
      "gridSize": "wide",
      "color": "orange",
      "dataSource": "scripts/crypto_data.py",
      "refreshInterval": 300,
      "config": {
        "seriesPath": "btc.historical",
        "index": "date",
        "categories": ["price"],
        "colors": ["orange"]
      }
    },
    {
      "id": "portfolio_distribution",
      "type": "donut_chart",
      "title": "Holdings",
      "gridSize": "medium",
      "dataSource": "state/portfolio",
      "config": {
        "seriesPath": "holdings",
        "index": "name",
        "category": "value",
        "colors": ["orange", "blue", "emerald", "violet"]
      }
    }
  ]
}
```
