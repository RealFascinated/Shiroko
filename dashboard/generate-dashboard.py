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
    "from": "now-7d",
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

def cache_rate(measure: str, window: str = "[5m]") -> str:
    """`rate()` the cumulative `<cache>:<measure>` counter, relabelling the
    `cache` series to its bare name by stripping the `:measure` suffix. The
    measure suffix is what makes `cache="x:hits" != cache="x:misses"`, so
    without this a hits/misses comparison (which needs one-to-one label
    matching) collapses to empty.
    """
    return (
        f'label_replace(rate(cache_entries{{job="$job",cache=~"[^:]+:{measure}"}}{window}),'
        f'"cache","$1","cache","([^:]+):.*")'
    )


# One entry per category: a row title (emoji) and the panels under it.
# Panel width is grid units; panels pack into 24-wide bands.
CATEGORIES = [
    {
        "key": "guilds",
        "title": "🏠 Guilds",
        "panels": [
            {"key": "guilds", "title": "Guild count", "expr": "last_over_time(guilds{job=\"$job\"}[1h])", "unit": "short", "width": 24, "legend": "guilds"},
        ],
    },
    {
        "key": "users",
        "title": "👥 Users",
        "panels": [
            {"key": "seen-users", "title": "Distinct users seen", "expr": "last_over_time(seen_users{job=\"$job\"}[1h])", "unit": "short", "width": 24, "legend": "users"},
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
        # Discord REST traffic, from the `@discordjs/rest` emitter. Route-keyed
        # series use the ID-stripped bucket route (`/channels/:id/messages`), so
        # per-route panels stay readable instead of exploding per channel.
        "key": "rest",
        "title": "🔌 Discord REST",
        "panels": [
            {
                "key": "rest-requests-rate",
                "title": "Requests per second",
                "expr": "sum(rate(discord_rest_requests_total{job=\"$job\"}[5m]))",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "requests",
            },
            {
                "key": "rest-errors-rate",
                "title": "Errors per second",
                "expr": "sum(rate(discord_rest_errors_total{job=\"$job\"}[5m]))",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "errors",
            },
            {
                "key": "rest-invalid",
                "title": "Invalid requests (window)",
                "expr": "discord_rest_invalid_requests{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "legend": "invalid",
            },
            {
                "key": "rest-requests-by-route",
                "title": "Requests per second by route",
                "expr": "sum by (route) (rate(discord_rest_requests_total{job=\"$job\"}[5m]))",
                "unit": "ops",
                "min": 0,
                "width": 24,
                "legend": "{{route}}",
            },
            {
                "key": "rest-latency-avg",
                "title": "REST latency (average)",
                "expr": "rate(discord_rest_request_duration_ms_sum{job=\"$job\"}[5m]) / rate(discord_rest_request_duration_ms_count{job=\"$job\"}[5m])",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "average",
            },
            {
                "key": "rest-latency-p95",
                "title": "REST latency (p95)",
                "expr": "histogram_quantile(0.95, sum(rate(discord_rest_request_duration_ms_bucket{job=\"$job\"}[5m])) by (le))",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "p95",
            },
            {
                "key": "rest-error-ratio",
                # Both operands are normalized to `route` alone so the label
                # sets match one-to-one and the division resolves per route.
                "title": "Error ratio by route",
                "expr": "sum by (route) (rate(discord_rest_errors_total{job=\"$job\"}[5m])) / sum by (route) (rate(discord_rest_requests_total{job=\"$job\"}[5m]))",
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "width": 24,
                "legend": "{{route}}",
            },
        ],
    },
    {
        # Rate limiter pressure. The wait/latency panels go quiet (gaps) when
        # no limits are being hit, which is the healthy state.
        "key": "rate-limits",
        "title": "🚦 Rate Limits",
        "panels": [
            {
                "key": "rate-limit-hits-rate",
                "title": "Rate limit hits per second",
                "expr": "sum(rate(discord_rest_rate_limits_total{job=\"$job\"}[5m]))",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "limited",
            },
            {
                "key": "rate-limit-global",
                "title": "Global rate limit hits",
                "expr": "discord_rest_global_rate_limits_total{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "legend": "global",
            },
            {
                "key": "rest-buckets",
                "title": "Buckets tracked",
                "expr": "discord_rest_buckets{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "legend": "buckets",
            },
            {
                "key": "rate-limit-hits-by-route",
                "title": "Rate limit hits per second by route",
                "expr": "sum by (route) (rate(discord_rest_rate_limits_total{job=\"$job\"}[5m]))",
                "unit": "ops",
                "min": 0,
                "width": 24,
                "legend": "{{route}}",
            },
            {
                "key": "rate-limit-wait-avg",
                "title": "Time waiting on a rate limit (average)",
                "expr": "rate(discord_rest_rate_limit_wait_ms_sum{job=\"$job\"}[5m]) / rate(discord_rest_rate_limit_wait_ms_count{job=\"$job\"}[5m])",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "average",
            },
            {
                "key": "rate-limit-wait-p95",
                "title": "Time waiting on a rate limit (p95)",
                "expr": "histogram_quantile(0.95, sum(rate(discord_rest_rate_limit_wait_ms_bucket{job=\"$job\"}[5m])) by (le))",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "legend": "p95",
            },
            {
                "key": "bucket-remaining",
                # Buckets are keyed by route, and a route can have many buckets
                # behind it (one per channel/guild), so this is the last
                # observation for the route rather than a precise per-bucket read.
                "title": "Bucket requests remaining",
                "expr": "discord_rest_bucket_remaining{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "legend": "{{route}}",
            },
            {
                "key": "bucket-capacity",
                "title": "Bucket capacity",
                "expr": "discord_rest_bucket_limit{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "legend": "{{route}}",
            },
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
        # One panel per cache series, split on the `cache` label's measure
        # suffix so occupancy and hit rate stay on separate charts.
        "key": "caches",
        "title": "🗃️ Caches",
        "panels": [
            {
                "key": "cache-size",
                "title": "Entries",
                "expr": "cache_entries{job=\"$job\",cache=~\"[^:]+:size\"}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "legend": "{{cache}}",
            },
            {
                "key": "cache-hit-rate",
                "title": "Hit rate",
                # hits and misses must align one-to-one under `+` and `/`, but the
                # raw `cache` label carries the measure (x:hits vs x:misses), so
                # normalizing each operand to the bare cache name is what makes
                # the ratio resolvable (see cache_rate).
                "expr": f"{cache_rate('hits')} / ({cache_rate('hits')} + {cache_rate('misses')})",
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "width": 12,
                # cache_rate normalizes the label to the bare name, so this
                # legends each series by cache.
                "legend": "{{cache}}",
            },
            {
                "key": "cache-loads",
                "title": "Loads per second",
                "expr": "rate(cache_entries{job=\"$job\",cache=~\"[^:]+:misses\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 24,
                "legend": "{{cache}}",
            },
        ],
    },
    {
        # Entry count per discord.js client cache. Guild-scoped caches
        # (members, presences, ...) are summed across guilds by the metric,
        # so each series is the process's total held entries.
        "key": "discord-caches",
        "title": "🧰 Discord Caches",
        "panels": [
            {
                "key": "discord-cache-entries",
                "title": "Discord cache entries",
                "expr": "discord_cache_entries{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 24,
                "legend": "{{cache}}",
            },
        ],
    },
    {
        # Media bucket occupancy: live objects plus the superseded backlog
        # awaiting the TTL sweep. Totals are the real S3 footprint.
        "key": "media",
        "title": "🖼️ Media",
        "panels": [
            {
                "key": "media-files",
                "title": "Stored files",
                "expr": "media_files{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "legend": "{{state}}",
            },
            {
                "key": "media-bytes",
                "title": "Stored size",
                "expr": "media_bytes{job=\"$job\"}",
                "unit": "bytes",
                "min": 0,
                "width": 12,
                "legend": "{{state}}",
            },
        ],
    },
    {
        "key": "events",
        "title": "📈 Events per second",
        "panels": [
            {
                "key": "messages",
                "title": "Messages",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"messages\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "messages",
            },
            {
                "key": "slash-commands",
                "title": "Slash commands",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"slash_commands\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "slash",
            },
            {
                "key": "components",
                "title": "Components",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"components\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "components",
            },
            {
                "key": "context-menus",
                "title": "Context menus",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"context_menus\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "context",
            },
            {
                "key": "member-joins",
                "title": "Member joins",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"member_joins\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "joins",
            },
            {
                "key": "presence-changes",
                "title": "Presence changes",
                "expr": "rate(discord_events_total{job=\"$job\",event=\"presence_changes\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 8,
                "legend": "presence",
            },
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
    {
        # Persistent command tallies from Postgres. The stacked total is the
        # all-time per-command share of traffic; the second panel is the
        # current per-second call rate.
        "key": "commands",
        "title": "⚡ Commands",
        "panels": [
            {
                "key": "command-calls-total",
                "title": "Command calls (total)",
                "expr": "command_calls_total{job=\"$job\"}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "legend": "{{command}}",
                "fillOpacity": 100,
            },
            {
                "key": "command-calls-rate",
                "title": "Command calls per second",
                "expr": "rate(command_calls_total{job=\"$job\"}[5m])",
                "unit": "ops",
                "min": 0,
                "width": 12,
                "legend": "{{command}}",
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


def timeseries_viz(unit: str, minv: float | None, maxv: float | None, fill_opacity: float = 10) -> dict:
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
            "fillOpacity": fill_opacity,
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
    fill_opacity: float = 10,
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
            "vizConfig": timeseries_viz(unit, minv, maxv, fill_opacity),
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
                    panel_id,
                    p["title"],
                    p["expr"],
                    p["unit"],
                    p.get("min"),
                    p.get("max"),
                    p["legend"],
                    p.get("fillOpacity", 10),
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