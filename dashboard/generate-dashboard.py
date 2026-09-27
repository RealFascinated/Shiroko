#!/usr/bin/env python3
"""Generate dashboard/dashboard.json: a Grafana v2 Dashboard for Arona's metrics.

Every panel queries VictoriaMetrics through the dashboard's `vm`
datasource variable. One `RowsLayout` row per metric category, emoji
titles on the rows only. Run with:  python3 dashboard/generate-dashboard.py
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "dashboard.json"

VM_PLUGIN = "victoriametrics-metrics-datasource"
VIZ_VERSION = "13.2.2"

# Stable dashboard uid: Grafana refuses to change the identifier on an
# existing dashboard, so a fixed uid lets re-imports apply as updates.
DASHBOARD_UID = "ad9gqmf"

DEFAULT_ANNOTATIONS = [
    {
        "kind": "AnnotationQuery",
        "spec": {
            "builtIn": True,
            "enable": True,
            "hide": True,
            "iconColor": "rgba(0, 211, 255, 1)",
            "name": "Annotations & Alerts",
            "query": {
                "datasource": {"name": "-- Grafana --"},
                "group": "grafana",
                "kind": "DataQuery",
                "spec": {},
                "version": "v0",
            },
        },
    }
]

DEFAULT_TIME_SETTINGS = {
    "autoRefresh": "10s",
    "autoRefreshIntervals": ["5s", "10s", "30s", "1m", "5m", "15m", "30m", "1h", "2h", "1d"],
    "fiscalYearStartMonth": 0,
    "from": "now-6h",
    "hideTimepicker": False,
    "timezone": "browser",
    "to": "now",
}

# The `vm` datasource variable, matching Grafana's exporter output.
VM_VARIABLE = {
    "kind": "DatasourceVariable",
    "spec": {
        "allowCustomValue": True,
        "current": {"text": "victoria-metrics", "value": "ffbmdvoh37lkwe"},
        "hide": "dontHide",
        "includeAll": False,
        "multi": False,
        "name": "vm",
        "options": [],
        "pluginId": VM_PLUGIN,
        "refresh": "onDashboardLoad",
        "regex": "",
        "skipUrlSync": False,
    },
}

# The `job` label variable: scopes every panel query to a selected job.
JOB_VARIABLE = {
    "kind": "QueryVariable",
    "spec": {
        "allowCustomValue": True,
        "current": {"text": "arona", "value": "arona"},
        "hide": "dontHide",
        "includeAll": True,
        "multi": False,
        "name": "job",
        "options": [],
        "query": {
            "datasource": {"name": "${vm}"},
            "group": VM_PLUGIN,
            "kind": "DataQuery",
            "spec": {
                # VictoriaMetrics datasource custom variable support parses this
                # PromVariableQuery shape (qryType 1 = LabelValues).
                "qryType": 1,
                "label": "job",
                "query": "label_values(job)",
            },
            "version": "v0",
        },
        "refresh": "onDashboardLoad",
        "regex": "",
        "skipUrlSync": False,
        "sort": "alphabeticalAsc",
    },
}

# One entry per category: a row title (emoji) and the panels under it.
# Panel width is grid units; panels pack into 24-wide bands.
CATEGORIES = [
    {
        "key": "guilds",
        "title": "🏠 Guilds",
        "panels": [
            {"key": "guilds", "title": "Guild count", "expr": "guilds{job=\"$job\"}", "unit": "short", "min": 0, "width": 24, "legend": "guilds"},
        ],
    },
    {
        "key": "users",
        "title": "👥 Users",
        "panels": [
            {"key": "seen-users", "title": "Distinct users seen", "expr": "seen_users{job=\"$job\"}", "unit": "short", "min": 0, "width": 24, "legend": "users"},
        ],
    },
    {
        "key": "cpu",
        "title": "⚙️ CPU",
        "panels": [
            {"key": "cpu-usage", "title": "Process CPU usage", "expr": "process_cpu_usage{job=\"$job\"}", "unit": "percent", "min": 0, "max": 100, "width": 24, "legend": "cpu"},
        ],
    },
    {
        "key": "memory",
        "title": "💾 Memory",
        "panels": [
            {"key": "ram-used", "title": "RAM used", "expr": "process_ram_used{job=\"$job\"}", "unit": "bytes", "min": 0, "width": 12, "legend": "used"},
            {"key": "ram-total", "title": "RAM total", "expr": "process_ram_total{job=\"$job\"}", "unit": "bytes", "min": 0, "width": 12, "legend": "total"},
            {
                "key": "ram-used-pct",
                "title": "RAM used (%)",
                "expr": "process_ram_used{job=\"$job\"} / process_ram_total{job=\"$job\"} * 100",
                "unit": "percent",
                "min": 0,
                "max": 100,
                "width": 24,
                "legend": "used",
            },
        ],
    },
    {
        "key": "gateway",
        "title": "🌐 Gateway",
        "panels": [
            {"key": "latency", "title": "Gateway heartbeat latency", "expr": "gateway_latency_ms{job=\"$job\"}", "unit": "ms", "min": 0, "width": 24, "legend": "latency"},
        ],
    },
    {
        "key": "uptime",
        "title": "⏱️ Uptime",
        "panels": [
            {"key": "uptime", "title": "Bot uptime", "expr": "uptime_seconds{job=\"$job\"}", "unit": "s", "min": 0, "width": 24, "legend": "uptime"},
        ],
    },
    {
        "key": "event-loop",
        "title": "🔄 Event Loop",
        "panels": [
            {
                "key": "loop-avg",
                "title": "Event loop delay (average)",
                "expr": "rate(event_loop_ms_sum{job=\"$job\"}[5m]) / rate(event_loop_ms_count{job=\"$job\"}[5m])",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "average",
            },
            {
                "key": "loop-p95",
                "title": "Event loop delay (p95)",
                "expr": "histogram_quantile(0.95, sum(rate(event_loop_ms_bucket{job=\"$job\"}[5m])) by (le))",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "p95",
            },
        ],
    },
]


def data_query(expr: str, legend: str) -> dict:
    """A v2 DataQueryKind: datasource ref + group (datasource type) on the query."""
    return {
        "datasource": {"name": "${vm}"},
        "group": VM_PLUGIN,
        "kind": "DataQuery",
        "spec": {"expr": expr, "legendFormat": legend, "queryType": "MetricsQL"},
        "version": "v0",
    }


def panel_query(expr: str, legend: str) -> dict:
    return {
        "kind": "PanelQuery",
        "spec": {"hidden": False, "query": data_query(expr, legend), "refId": "A"},
    }


def timeseries_viz(unit: str, minv: float | None, maxv: float | None) -> dict:
    defaults: dict = {
        "color": {"mode": "palette-classic"},
        "custom": {
            "axisBorderShow": False,
            "axisCenteredZero": False,
            "axisColorMode": "text",
            "axisLabel": "",
            "axisPlacement": "auto",
            "barAlignment": 0,
            "barWidthFactor": 0.6,
            "drawStyle": "line",
            "fillOpacity": 10,
            "gradientMode": "none",
            "hideFrom": {"legend": False, "tooltip": False, "viz": False},
            "insertNulls": False,
            "lineInterpolation": "linear",
            "lineWidth": 1,
            "pointSize": 5,
            "scaleDistribution": {"type": "linear"},
            "showPoints": "never",
            "showValues": False,
            "spanNulls": False,
            "stacking": {"group": "A", "mode": "none"},
            "thresholdsStyle": {"mode": "off"},
        },
        "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": 0}]},
        "unit": unit,
    }
    if minv is not None:
        defaults["min"] = minv
    if maxv is not None:
        defaults["max"] = maxv
    return {
        "group": "timeseries",
        "kind": "VizConfig",
        "spec": {
            "fieldConfig": {"defaults": defaults, "overrides": []},
            "options": {
                "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True},
                "tooltip": {"hideZeros": False, "maxHeight": 600, "mode": "multi", "sort": "desc"},
            },
        },
        "version": VIZ_VERSION,
    }


def panel(
    panel_id: int,
    title: str,
    expr: str,
    unit: str,
    minv: float | None,
    maxv: float | None,
    legend: str,
) -> dict:
    return {
        "kind": "Panel",
        "spec": {
            "data": {
                "kind": "QueryGroup",
                "spec": {
                    "queries": [panel_query(expr, legend)],
                    "queryOptions": {},
                    "transformations": [],
                },
            },
            "description": "",
            "id": panel_id,
            "links": [],
            "title": title,
            "vizConfig": timeseries_viz(unit, minv, maxv),
        },
    }


def build() -> dict:
    elements: dict[str, dict] = {}
    rows: list[dict] = []
    panel_id = 0

    for cat in CATEGORIES:
        row_items: list[dict] = []
        y = 0

        panels = list(cat["panels"])
        index = 0
        while index < len(panels):
            # Pack the category's panels into 24-wide bands (two 12s side by side, one 24 full width).
            band: list[dict] = []
            band_width = 0
            while index < len(panels) and band_width + panels[index]["width"] <= 24:
                band.append(panels[index])
                band_width += panels[index]["width"]
                index += 1

            x = 0
            for p in band:
                panel_id += 1
                panel_key = f"panel-{panel_id}"
                elements[panel_key] = panel(
                    panel_id, p["title"], p["expr"], p["unit"], p.get("min"), p.get("max"), p["legend"]
                )
                row_items.append(
                    {
                        "kind": "GridLayoutItem",
                        "spec": {
                            "element": {"kind": "ElementReference", "name": panel_key},
                            "height": 8,
                            "width": p["width"],
                            "x": x,
                            "y": y,
                        },
                    }
                )
                x += p["width"]
            y += 8

        rows.append(
            {
                "kind": "RowsLayoutRow",
                "spec": {
                    "collapse": False,
                    "layout": {"kind": "GridLayout", "spec": {"items": row_items}},
                    "title": cat["title"],
                },
            }
        )

    return {
        "apiVersion": "dashboard.grafana.app/v2",
        "kind": "Dashboard",
        "metadata": {"name": DASHBOARD_UID},
        "spec": {
            "annotations": DEFAULT_ANNOTATIONS,
            "cursorSync": "Off",
            "editable": True,
            "elements": elements,
            "layout": {"kind": "RowsLayout", "spec": {"rows": rows}},
            "links": [],
            "liveNow": False,
            # `preferences.layout` is the default template for new containers:
            # the schema only accepts GridLayout or AutoGridLayout there.
            "preferences": {"layout": {"kind": "GridLayout", "spec": {"items": []}}},
            "preload": False,
            "tags": ["arona", "metrics"],
            "timeSettings": DEFAULT_TIME_SETTINGS,
            "title": "Arona",
            "variables": [VM_VARIABLE, JOB_VARIABLE],
        },
    }


if __name__ == "__main__":
    dashboard = build()
    OUT.write_text(json.dumps(dashboard, indent=2) + "\n")
    print(f"wrote {OUT}")