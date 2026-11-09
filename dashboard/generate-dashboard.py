#!/usr/bin/env python3
"""Generate dashboard/dashboard.json: a Grafana v2 Dashboard for Arona's metrics,
and dashboard/alerts.json: the alert rules over the same series.

Every panel queries VictoriaMetrics through the dashboard's `vm`
datasource variable. The first row is an at-a-glance stat strip; the
rows below drill into one subsystem each, with the noisy, rarely needed
ones collapsed. Run with:  python3 dashboard/generate-dashboard.py
"""

import json
from pathlib import Path

OUT = Path(__file__).parent / "dashboard.json"
# Grafana file-provisioned alert rules (provisioning/alerting/), or import
# through Alerting > Alert rules > Import.
ALERTS_OUT = Path(__file__).parent / "alerts.json"

VM_PLUGIN = "victoriametrics-metrics-datasource"
VIZ_VERSION = "13.2.2"

# Stable dashboard uid: Grafana refuses to change the identifier on an
# existing dashboard, so a fixed uid lets re-imports apply as updates.
DASHBOARD_UID = "ad9gqmf"

# Every series selector: `=~` so the variables' All option (`.+`) matches.
SEL = 'job=~"$job",cluster=~"$cluster"'
RATE = "[$__rate_interval]"

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
    },
    {
        # A fresh process reports low uptime for its first couple of minutes,
        # which marks every restart (deploys and crashes) across all panels.
        "kind": "AnnotationQuery",
        "spec": {
            "builtIn": False,
            "enable": True,
            "hide": False,
            "iconColor": "rgba(255, 152, 48, 1)",
            "name": "Restarts",
            "query": {
                "datasource": {"name": "${vm}"},
                "group": VM_PLUGIN,
                "kind": "DataQuery",
                "spec": {
                    "expr": f"uptime_seconds{{{SEL}}} < 120",
                    "step": "60s",
                    "titleFormat": "Restart",
                    "textFormat": "cluster {{cluster}}",
                },
                "version": "v0",
            },
        },
    },
]

DEFAULT_TIME_SETTINGS = {
    "autoRefresh": "1m",
    "autoRefreshIntervals": ["10s", "30s", "1m", "5m", "15m", "30m", "1h"],
    "fiscalYearStartMonth": 0,
    "from": "now-24h",
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
        "allValue": ".+",
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

# The `cluster` label variable: every process pushes its cluster id, so a
# single cluster can be inspected on its own. Totals sum whatever is selected.
CLUSTER_VARIABLE = {
    "kind": "QueryVariable",
    "spec": {
        "allowCustomValue": True,
        "allValue": ".+",
        "current": {"text": "All", "value": "$__all"},
        "hide": "dontHide",
        "includeAll": True,
        "multi": False,
        "name": "cluster",
        "options": [],
        "query": {
            "datasource": {"name": "${vm}"},
            "group": VM_PLUGIN,
            "kind": "DataQuery",
            "spec": {
                "qryType": 1,
                "label": "cluster",
                "query": 'label_values(uptime_seconds{job=~"$job"}, cluster)',
            },
            "version": "v0",
        },
        "refresh": "onDashboardLoad",
        "regex": "",
        "skipUrlSync": False,
        "sort": "numericalAsc",
    },
}

GREEN = [(None, "green")]
BLUE = [(None, "blue")]


def m(metric: str, extra: str = "") -> str:
    return f"{metric}{{{SEL}{',' + extra if extra else ''}}}"


def quantile(q: float, metric: str, by: str = "", window: str = RATE) -> str:
    labels = f"{by}, le" if by else "le"
    return f"histogram_quantile({q}, sum by ({labels}) (rate({m(metric + '_bucket')}{window})))"


def quantiles(metric: str, by: str = "") -> list[tuple[str, str]]:
    return [(quantile(q, metric, by), name) for q, name in ((0.5, "p50"), (0.95, "p95"), (0.99, "p99"))]


def counted(expr: str) -> str:
    # A counter that has never moved has no series at all, which a stat
    # would render as "No data" instead of the healthy zero it means.
    return f"{expr} or vector(0)"


def cache_rate(measure: str) -> str:
    """`rate()` the cumulative `<cache>:<measure>` counter, relabelling the
    `cache` series to its bare name by stripping the `:measure` suffix. The
    measure suffix is what makes `cache="x:hits" != cache="x:misses"`, so
    without this a hits/misses comparison (which needs one-to-one label
    matching) collapses to empty.
    """
    series = m("cache_entries", f'cache=~"[^:]+:{measure}"')
    return f'sum by (cache) (label_replace(rate({series}{RATE}),"cache","$1","cache","([^:]+):.*"))'


def stat(title: str, expr: str, unit: str, thresholds: list, desc: str) -> dict:
    return {"viz": "stat", "title": title, "expr": expr, "unit": unit, "thresholds": thresholds, "desc": desc, "width": 4, "height": 4}


# One entry per row. Panel width is grid units; panels pack into 24-wide
# bands. `queries` is a list of (expr, legend); `expr`/`legend` is the
# single-query shorthand.
CATEGORIES = [
    {
        "title": "📊 Overview",
        "panels": [
            stat("Uptime", f"min({m('uptime_seconds')})", "s", [(None, "orange"), (3600, "green")], "Time since the most recently started cluster started. Orange for the first hour after any cluster restarts."),
            stat("Guilds", f"sum({m('guilds')})", "short", BLUE, "Guilds the bot is currently in."),
            stat("Gateway ping", f"max({m('gateway_latency_ms')})", "ms", [(None, "green"), (250, "yellow"), (500, "red")], "Websocket heartbeat round trip."),
            stat("Event loop p95", quantile(0.95, "event_loop_ms", window="[5m]"), "ms", [(None, "green"), (50, "yellow"), (200, "red")], "p95 event loop delay over 5 minutes. High values mean something is blocking the loop."),
            stat("CPU", f"max({m('process_cpu_usage')})", "percent", [(None, "green"), (50, "yellow"), (80, "red")], "Process CPU usage."),
            stat("Heap used", f"max({m('process_ram_used')} / {m('process_ram_total')}) * 100", "percent", [(None, "green"), (70, "yellow"), (90, "red")], "Heap used as a share of the heap size limit, for the fullest cluster."),
            stat("Commands / min", counted(f"sum(rate({m('command_duration_ms_count')}[5m])) * 60"), "short", BLUE, "Slash and context menu commands handled per minute, over 5 minutes."),
            stat("Command errors (24h)", counted(f"sum(increase({m('command_errors_total')}[24h]))"), "short", [(None, "green"), (1, "red")], "Command handlers that threw in the last 24 hours."),
            stat("Ack p95", quantile(0.95, "discord_interaction_ack_ms", window="[15m]"), "ms", [(None, "green"), (1500, "yellow"), (2500, "red")], "p95 time from interaction creation to our first response, over 15 minutes. Discord expires interactions at 3s."),
            stat("Expired interactions (24h)", counted(f"sum(increase({m('discord_interactions_expired_total')}[24h]))"), "short", [(None, "green"), (1, "red")], "Interaction callbacks Discord rejected with 404 because we answered too late."),
            stat("Rate limit hits (1h)", counted(f"sum(increase({m('discord_rest_rate_limits_total')}[1h]))"), "short", [(None, "green"), (1, "yellow"), (10, "red")], "Requests the REST manager had to queue behind a rate limit in the last hour."),
            stat("Job failures (24h)", counted(f"sum(increase({m('job_failures_total')}[24h]))"), "short", [(None, "green"), (1, "red")], "Scheduled job runs that threw in the last 24 hours."),
        ],
    },
    {
        "title": "⚡ Commands & interactions",
        "panels": [
            {
                "viz": "bargauge",
                "title": "Top commands (range)",
                "expr": f"topk(10, sum by (command) (increase({m('command_calls_total')}[$__range])))",
                "legend": "{{command}}",
                "unit": "short",
                "width": 8,
                "desc": "Most used commands over the selected time range.",
            },
            {
                "title": "Command calls per day",
                "expr": f"increase({m('command_calls_total')}[1d])",
                "legend": "{{command}}",
                "unit": "short",
                "min": 0,
                "width": 16,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1d",
                "desc": "Daily calls per command, from the persistent tallies in Postgres.",
            },
            {
                "title": "Command latency",
                "queries": quantiles("command_duration_ms"),
                "unit": "ms",
                "min": 0,
                "width": 12,
                "desc": "Handler duration across all commands, including deferred work.",
            },
            {
                "viz": "bargauge",
                "title": "Slowest commands (p95, range)",
                "expr": f"topk(10, histogram_quantile(0.95, sum by (command, le) (rate({m('command_duration_ms_bucket')}[$__range]))))",
                "legend": "{{command}}",
                "unit": "ms",
                "width": 12,
                "desc": "Commands with the highest p95 handler duration over the selected range.",
            },
            {
                "title": "Interaction ack latency",
                "queries": [(quantile(0.5, "discord_interaction_ack_ms"), "p50"), (quantile(0.95, "discord_interaction_ack_ms"), "p95")],
                "unit": "ms",
                "min": 0,
                "width": 12,
                "thresholds": [(None, "transparent"), (2000, "yellow"), (3000, "red")],
                "desc": "Interaction creation to our first callback. Past 3s Discord rejects the reply.",
            },
            {
                "title": "Command errors per hour",
                "expr": f"sum by (command) (increase({m('command_errors_total')}[1h]))",
                "legend": "{{command}}",
                "unit": "short",
                "min": 0,
                "width": 6,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "Command handlers that threw, by command.",
            },
            {
                "title": "Expired interactions per hour",
                "expr": f"sum(increase({m('discord_interactions_expired_total')}[1h]))",
                "legend": "expired",
                "unit": "short",
                "min": 0,
                "width": 6,
                "style": "bars",
                "minStep": "1h",
                "desc": "Interaction callbacks answered with 404 because the 3s window had passed.",
            },
        ],
    },
    {
        "title": "📈 Gateway & events",
        "panels": [
            {
                "title": "Messages & presence per second",
                "expr": f"sum by (event) (rate({m('discord_events_total', 'event=~\"messages|presence_changes|member_joins\"')}{RATE}))",
                "legend": "{{event}}",
                "unit": "ops",
                "min": 0,
                "width": 12,
                "desc": "High-volume gateway traffic.",
            },
            {
                "title": "Interactions per second",
                "expr": f"sum by (event) (rate({m('discord_events_total', 'event=~\"slash_commands|components|context_menus\"')}{RATE}))",
                "legend": "{{event}}",
                "unit": "ops",
                "min": 0,
                "width": 12,
                "desc": "Slash commands, components and context menus received.",
            },
            {
                "title": "Gateway heartbeat latency",
                "expr": m("gateway_latency_ms"),
                "legend": "cluster {{cluster}}",
                "unit": "ms",
                "min": 0,
                "width": 12,
                "thresholds": [(None, "transparent"), (250, "yellow"), (500, "red")],
                "desc": "Websocket heartbeat round trip.",
            },
            {
                "title": "Shard lifecycle per hour",
                "expr": f"sum by (event) (increase({m('discord_gateway_lifecycle_total')}[1h]))",
                "legend": "{{event}}",
                "unit": "short",
                "min": 0,
                "width": 6,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "Shard disconnects, reconnect attempts and resumes. A healthy bot shows the occasional resume and nothing else.",
            },
            {
                "title": "Disconnects by close code",
                "expr": f"sum by (code) (increase({m('discord_gateway_disconnects_total')}[1h]))",
                "legend": "{{code}}",
                "unit": "short",
                "min": 0,
                "width": 6,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "Gateway close codes per hour. 4004 (bad token) and 4014 (disallowed intent) are fatal.",
            },
        ],
    },
    {
        "title": "🏠 Guilds & users",
        "panels": [
            {"title": "Guild count", "expr": f"sum(last_over_time({m('guilds')}[1h]))", "legend": "guilds", "unit": "short", "width": 8, "desc": "Guilds the bot is in."},
            {"title": "Distinct users seen", "expr": f"last_over_time({m('seen_users')}[1h])", "legend": "users", "unit": "short", "width": 8, "desc": "Users with a global user row."},
            {
                "title": "Guild joins and leaves per day",
                "expr": f"sum by (change) (increase({m('guild_changes_total')}[1d]))",
                "legend": "{{change}}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "style": "bars",
                "minStep": "1d",
                "desc": "Guilds added or removed. Counted from the gateway, so a restart does not count its initial guild list.",
            },
        ],
    },
    {
        "title": "🧠 Runtime",
        "panels": [
            {"title": "CPU usage", "expr": m("process_cpu_usage"), "legend": "cluster {{cluster}}", "unit": "percent", "min": 0, "max": 100, "width": 8, "desc": "Process CPU usage."},
            {
                "title": "Heap used vs limit",
                "queries": [(m("process_ram_used"), "used {{cluster}}"), (m("process_ram_total"), "limit {{cluster}}")],
                "unit": "bytes",
                "min": 0,
                "width": 8,
                "desc": "Heap in use against the V8 heap size limit.",
            },
            {
                "title": "Memory by kind",
                "expr": m("process_memory_bytes"),
                "legend": "{{kind}} {{cluster}}",
                "unit": "bytes",
                "min": 0,
                "width": 8,
                "desc": "process.memoryUsage(). A rising external or array_buffers line with flat heap points at buffers (images, attachments).",
            },
            {
                "title": "Event loop delay",
                "queries": quantiles("event_loop_ms"),
                "unit": "ms",
                "min": 0,
                "width": 8,
                "thresholds": [(None, "transparent"), (50, "yellow"), (200, "red")],
                "desc": "How late the event loop runs scheduled work.",
            },
            {
                "viz": "bargauge",
                "title": "Slowest event handlers (p95, range)",
                "expr": f"topk(10, histogram_quantile(0.95, sum by (handler, le) (rate({m('event_handler_duration_ms_bucket')}[$__range]))))",
                "legend": "{{handler}}",
                "unit": "ms",
                "width": 8,
                "desc": "Event bus handlers with the highest p95 duration. Handlers run in order, so a slow one delays the rest.",
            },
            {
                "title": "Event handler errors per hour",
                "expr": f"sum by (handler) (increase({m('event_handler_errors_total')}[1h]))",
                "legend": "{{handler}}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "Event bus handlers that threw.",
            },
        ],
    },
    {
        "title": "🗄️ Database",
        "panels": [
            {
                "title": "Pool connections",
                "expr": f"sum by (state) ({m('db_pool_connections')})",
                "legend": "{{state}}",
                "unit": "short",
                "min": 0,
                "width": 8,
                "desc": "Postgres pool connections, summed across clusters (each holds its own pool). Any sustained waiting means a pool is exhausted.",
            },
            {"title": "Query latency", "queries": quantiles("db_query_duration_ms"), "unit": "ms", "min": 0, "width": 8, "desc": "Postgres query duration measured at the pool."},
            {
                "title": "Queries and errors per second",
                "queries": [
                    (f"sum(rate({m('db_query_duration_ms_count')}{RATE}))", "queries"),
                    (f"sum(rate({m('db_query_errors_total')}{RATE}))", "errors"),
                ],
                "unit": "ops",
                "min": 0,
                "width": 8,
                "desc": "Postgres throughput and failed queries.",
            },
        ],
    },
    {
        # Route-keyed series use the ID-stripped bucket route
        # (`/channels/:id/messages`), so per-route panels stay readable.
        "title": "🔌 Discord REST",
        "panels": [
            {
                "title": "Requests and errors per second",
                "queries": [
                    (f"sum(rate({m('discord_rest_requests_total')}{RATE}))", "requests"),
                    (f"sum(rate({m('discord_rest_errors_total')}{RATE}))", "errors"),
                ],
                "unit": "ops",
                "min": 0,
                "width": 12,
                "desc": "Outgoing Discord API traffic.",
            },
            {"title": "REST latency", "queries": quantiles("discord_rest_request_duration_ms"), "unit": "ms", "min": 0, "width": 12, "desc": "Discord API response time, excluding rate limit queueing."},
            {
                "viz": "bargauge",
                "title": "Top routes (range)",
                "expr": f"topk(10, sum by (route) (increase({m('discord_rest_requests_total')}[$__range])))",
                "legend": "{{route}}",
                "unit": "short",
                "width": 8,
                "desc": "Routes with the most requests over the selected range.",
            },
            {
                # Both operands are normalized to `route` alone so the label
                # sets match one-to-one and the division resolves per route.
                "title": "Error ratio by route",
                "expr": f"sum by (route) (rate({m('discord_rest_errors_total')}{RATE})) / sum by (route) (rate({m('discord_rest_requests_total')}{RATE}))",
                "legend": "{{route}}",
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "width": 16,
                "legendTable": True,
                "desc": "Share of each route's requests that errored.",
            },
            {
                "title": "Invalid requests (window)",
                "expr": f"sum({m('discord_rest_invalid_requests')})",
                "legend": "invalid",
                "unit": "short",
                "min": 0,
                "width": 8,
                "thresholds": [(None, "transparent"), (5000, "yellow"), (9000, "red")],
                "desc": "401/403/429 responses in Discord's 10 minute window. 10,000 gets the bot IP banned for an hour.",
            },
            {"title": "Global requests remaining", "expr": m("discord_rest_global_remaining"), "legend": "cluster {{cluster}}", "unit": "short", "min": 0, "width": 8, "desc": "Requests left in the current global (50/s) window."},
            {
                "title": "Buckets and hashes tracked",
                "queries": [(f"sum({m('discord_rest_buckets')})", "buckets"), (f"sum({m('discord_rest_hashes')})", "hashes")],
                "unit": "short",
                "min": 0,
                "width": 8,
                "desc": "Rate limit buckets and route hashes the REST manager holds.",
            },
        ],
    },
    {
        # The wait panels go quiet (gaps) when no limits are being hit, which
        # is the healthy state, so the row starts collapsed.
        "title": "🚦 Rate limits",
        "collapse": True,
        "panels": [
            {
                "title": "Rate limit hits per second by route",
                "expr": f"sum by (route) (rate({m('discord_rest_rate_limits_total')}{RATE}))",
                "legend": "{{route}}",
                "unit": "ops",
                "min": 0,
                "width": 12,
                "legendTable": True,
                "desc": "Requests queued behind a rate limit, by route.",
            },
            {"title": "Time waiting on a rate limit", "queries": quantiles("discord_rest_rate_limit_wait_ms")[:2], "unit": "ms", "min": 0, "width": 12, "desc": "How long queued requests waited."},
            {
                # A route can have many buckets behind it (one per channel or
                # guild), so this is the last observation for the route rather
                # than a precise per-bucket read.
                "viz": "bargauge",
                "title": "Least bucket headroom",
                "expr": f"bottomk(10, min by (route) ({m('discord_rest_bucket_remaining')} / {m('discord_rest_bucket_limit')}))",
                "legend": "{{route}}",
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "width": 12,
                "thresholds": [(None, "red"), (0.2, "yellow"), (0.5, "green")],
                "desc": "Routes closest to their bucket limit.",
            },
            {
                "title": "Global rate limit hits per hour",
                "expr": f"sum(increase({m('discord_rest_global_rate_limits_total')}[1h]))",
                "legend": "global",
                "unit": "short",
                "min": 0,
                "width": 12,
                "style": "bars",
                "minStep": "1h",
                "desc": "Times the global 50/s limit was hit.",
            },
        ],
    },
    {
        # Counters are per boot, so `increase()` absorbs the reset a restart
        # causes. Last-success is absent until a job first succeeds, so a
        # blank cell there is a job that has never completed since boot.
        "title": "⏲️ Jobs",
        "panels": [
            {
                "viz": "table",
                "title": "Jobs",
                "queries": [
                    (f"time() - min by (name) ({m('job_last_success_timestamp_seconds')})", "Since success"),
                    (f"max by (name) ({m('job_interval_seconds')})", "Interval"),
                    (f"max by (name) ({m('job_last_duration_seconds')})", "Last duration"),
                    (f"sum by (name) (increase({m('job_runs_total')}[$__range]))", "Runs"),
                    (f"sum by (name) (increase({m('job_failures_total')}[$__range]))", "Failures"),
                    (f"sum by (name) (increase({m('job_skips_total')}[$__range]))", "Skips"),
                ],
                "columnUnits": {"Since success": "s", "Interval": "s", "Last duration": "s"},
                "width": 24,
                "desc": "Scheduled jobs. Runs, failures and skips cover the selected range. A skip is a tick that found the previous run still going.",
            },
            {
                "title": "Failures per hour",
                "expr": f"sum by (name) (increase({m('job_failures_total')}[1h]))",
                "legend": "{{name}}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "Job runs that threw.",
            },
            {"title": "Last run duration", "expr": f"max by (name) ({m('job_last_duration_seconds')})", "legend": "{{name}}", "unit": "s", "min": 0, "width": 12, "desc": "Wall time of each job's most recent run."},
            {
                "title": "Reminder delivery lag",
                "queries": [(quantile(0.5, "reminder_delivery_lag_ms", window="[30m]"), "p50"), (quantile(0.95, "reminder_delivery_lag_ms", window="[30m]"), "p95")],
                "unit": "ms",
                "min": 0,
                "width": 12,
                "thresholds": [(None, "transparent"), (30000, "yellow"), (60000, "red")],
                "desc": "How late reminders are delivered past their due time. The sweep runs every 30s, so up to 30s is expected.",
            },
            {
                "title": "Reminders dropped per hour",
                "expr": f"sum(increase({m('reminders_dropped_total')}[1h]))",
                "legend": "dropped",
                "unit": "short",
                "min": 0,
                "width": 12,
                "style": "bars",
                "minStep": "1h",
                "desc": "Due reminders that could not be delivered by DM or in their channel.",
            },
        ],
    },
    {
        "title": "🗃️ Caches",
        "collapse": True,
        "panels": [
            {
                # hits and misses must align one-to-one under `+` and `/`, but
                # the raw `cache` label carries the measure (x:hits vs
                # x:misses), so each operand is normalized (see cache_rate).
                "title": "Hit rate",
                "expr": f"{cache_rate('hits')} / ({cache_rate('hits')} + {cache_rate('misses')})",
                "legend": "{{cache}}",
                "unit": "percentunit",
                "min": 0,
                "max": 1,
                "width": 12,
                "desc": "Share of cache reads served without a load.",
            },
            {
                "title": "Loads per second",
                "expr": cache_rate("misses"),
                "legend": "{{cache}}",
                "unit": "ops",
                "min": 0,
                "width": 12,
                "desc": "Cache misses, each of which loads from the source.",
            },
            {
                "viz": "bargauge",
                "title": "Entries",
                "expr": f"sum by (cache) ({m('cache_entries', 'cache=~\"[^:]+:size\"')})",
                "legend": "{{cache}}",
                "unit": "short",
                "width": 12,
                "desc": "Entries held per app cache.",
            },
            {
                "viz": "bargauge",
                "title": "Discord cache entries",
                "expr": f"sum by (cache) ({m('discord_cache_entries')})",
                "legend": "{{cache}}",
                "unit": "short",
                "width": 12,
                "desc": "Entries per discord.js cache, summed across guilds.",
            },
        ],
    },
    {
        # Media bucket occupancy: live objects plus the superseded backlog
        # awaiting the TTL sweep. Totals are the real S3 footprint.
        "title": "🖼️ Media",
        "collapse": True,
        "panels": [
            {"title": "Stored files", "expr": m("media_files"), "legend": "{{state}}", "unit": "short", "min": 0, "width": 12, "desc": "Objects in the media bucket by state."},
            {"title": "Stored size", "expr": m("media_bytes"), "legend": "{{state}}", "unit": "bytes", "min": 0, "width": 12, "desc": "Media bucket size by state."},
            {"title": "S3 latency (p95)", "expr": quantile(0.95, "storage_operation_duration_ms", by="op"), "legend": "{{op}}", "unit": "ms", "min": 0, "width": 12, "desc": "S3 write and delete duration."},
            {
                "title": "S3 errors per hour",
                "expr": f"sum by (op) (increase({m('storage_operation_errors_total')}[1h]))",
                "legend": "{{op}}",
                "unit": "short",
                "min": 0,
                "width": 12,
                "style": "bars",
                "stacking": "normal",
                "minStep": "1h",
                "desc": "S3 operations that failed.",
            },
        ],
    },
]


def data_query(expr: str, legend: str, min_step: str | None, instant: bool) -> dict:
    """A v2 DataQueryKind: datasource ref + group (datasource type) on the query.

    `min_step` is the query editor's Min step, which the plugin sends as the
    query's `interval`.
    """
    spec: dict = {"expr": expr, "legendFormat": legend, "queryType": "MetricsQL"}
    if min_step is not None:
        spec["interval"] = min_step
    if instant:
        spec.update({"instant": True, "range": False, "format": "table"})
    return {
        "datasource": {"name": "${vm}"},
        "group": VM_PLUGIN,
        "kind": "DataQuery",
        "spec": spec,
        "version": "v0",
    }


def thresholds_config(steps: list) -> dict:
    # The served OpenAPI schema types the base step's value as a plain number,
    # rejecting the null (-Infinity) the CUE schema allows; every series here
    # is non-negative, so 0 is an equivalent base.
    return {"mode": "absolute", "steps": [{"color": color, "value": 0 if value is None else value} for value, color in steps]}


def viz_config(group: str, defaults: dict, options: dict, overrides: list | None = None) -> dict:
    return {
        "group": group,
        "kind": "VizConfig",
        "spec": {"fieldConfig": {"defaults": defaults, "overrides": overrides or []}, "options": options},
        "version": VIZ_VERSION,
    }


def bounds(p: dict, defaults: dict) -> dict:
    if "min" in p:
        defaults["min"] = p["min"]
    if "max" in p:
        defaults["max"] = p["max"]
    return defaults


REDUCE_LAST = {"calcs": ["lastNotNull"], "fields": "", "values": False}


def timeseries_viz(p: dict) -> dict:
    defaults = bounds(
        p,
        {
            "color": {"mode": "palette-classic"},
            "custom": {
                "axisBorderShow": False,
                "axisCenteredZero": False,
                "axisColorMode": "text",
                "axisLabel": "",
                "axisPlacement": "auto",
                "barAlignment": 0,
                "barWidthFactor": 0.6,
                "drawStyle": p.get("style", "line"),
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
                "stacking": {"group": "A", "mode": p.get("stacking", "none")},
                "thresholdsStyle": {"mode": "dashed" if "thresholds" in p else "off"},
            },
            "thresholds": thresholds_config(p.get("thresholds", GREEN)),
            "unit": p["unit"],
        },
    )
    legend = (
        {"calcs": ["mean", "max", "lastNotNull"], "displayMode": "table", "placement": "right", "showLegend": True, "sortBy": "Max", "sortDesc": True}
        if p.get("legendTable")
        else {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True}
    )
    return viz_config(
        "timeseries",
        defaults,
        {"legend": legend, "tooltip": {"hideZeros": True, "maxHeight": 600, "mode": "multi", "sort": "desc"}},
    )


def stat_viz(p: dict) -> dict:
    return viz_config(
        "stat",
        {"color": {"mode": "thresholds"}, "thresholds": thresholds_config(p["thresholds"]), "unit": p["unit"]},
        {
            "colorMode": "background",
            "graphMode": "area",
            "justifyMode": "center",
            "orientation": "auto",
            "percentChangeColorMode": "standard",
            "reduceOptions": REDUCE_LAST,
            "showPercentChange": False,
            "textMode": "value",
            "wideLayout": True,
        },
    )


def bargauge_viz(p: dict) -> dict:
    thresholds = p.get("thresholds")
    return viz_config(
        "bargauge",
        bounds(
            p,
            {
                "color": {"mode": "thresholds"} if thresholds else {"mode": "continuous-BlPu"},
                "thresholds": thresholds_config(thresholds or GREEN),
                "unit": p["unit"],
            },
        ),
        {
            "displayMode": "gradient",
            "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": False},
            "maxVizHeight": 300,
            "minVizHeight": 16,
            "minVizWidth": 8,
            "namePlacement": "left",
            "orientation": "horizontal",
            "reduceOptions": REDUCE_LAST,
            "showUnfilled": True,
            "sizing": "auto",
            "valueMode": "color",
        },
    )


def table_viz(p: dict) -> dict:
    overrides = [
        {"matcher": {"id": "byName", "options": column}, "properties": [{"id": "unit", "value": unit}]}
        for column, unit in p.get("columnUnits", {}).items()
    ]
    return viz_config(
        "table",
        {"custom": {"align": "auto", "cellOptions": {"type": "auto"}, "inspect": False}, "thresholds": thresholds_config(GREEN), "decimals": 0},
        {"cellHeight": "sm", "showHeader": True, "sortBy": [{"displayName": "name", "desc": False}]},
        overrides,
    )


def transformation(transformer_id: str, options: dict) -> dict:
    return {"kind": "Transformation", "group": transformer_id, "spec": {"options": options}}


def table_transformations(queries: list[tuple[str, str]]) -> list[dict]:
    # Each instant table query yields a `Value #<refId>` column; merging joins
    # them on `name`, and organize names the value columns after their query.
    rename = {f"Value #{chr(65 + i)}": legend for i, (_, legend) in enumerate(queries)}
    return [
        transformation("merge", {}),
        transformation(
            "organize",
            {
                "excludeByName": {"Time": True, "job": True},
                "indexByName": {"name": 0, **{legend: i + 1 for i, legend in enumerate(rename.values())}},
                "renameByName": rename,
            },
        ),
    ]


VIZ = {"timeseries": timeseries_viz, "stat": stat_viz, "bargauge": bargauge_viz, "table": table_viz}


def panel(panel_id: int, p: dict) -> dict:
    kind = p.get("viz", "timeseries")
    queries = p.get("queries") or [(p["expr"], p.get("legend", ""))]
    instant = kind in ("bargauge", "table")
    return {
        "kind": "Panel",
        "spec": {
            "data": {
                "kind": "QueryGroup",
                "spec": {
                    "queries": [
                        {
                            "kind": "PanelQuery",
                            "spec": {
                                "hidden": False,
                                "query": data_query(expr, legend, p.get("minStep"), instant),
                                "refId": chr(65 + i),
                            },
                        }
                        for i, (expr, legend) in enumerate(queries)
                    ],
                    "queryOptions": {},
                    "transformations": table_transformations(queries) if kind == "table" else [],
                },
            },
            "description": p["desc"],
            "id": panel_id,
            "links": [],
            "title": p["title"],
            "vizConfig": VIZ[kind](p),
        },
    }


def build() -> dict:
    elements: dict[str, dict] = {}
    rows: list[dict] = []
    panel_id = 0

    for cat in CATEGORIES:
        row_items: list[dict] = []
        y = 0
        panels = cat["panels"]
        index = 0
        while index < len(panels):
            # Pack the row's panels into 24-wide bands, as tall as their tallest panel.
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
                elements[panel_key] = panel(panel_id, p)
                row_items.append(
                    {
                        "kind": "GridLayoutItem",
                        "spec": {
                            "element": {"kind": "ElementReference", "name": panel_key},
                            "height": p.get("height", 8),
                            "width": p["width"],
                            "x": x,
                            "y": y,
                        },
                    }
                )
                x += p["width"]
            y += max(p.get("height", 8) for p in band)

        rows.append(
            {
                "kind": "RowsLayoutRow",
                "spec": {
                    "collapse": cat.get("collapse", False),
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
            "cursorSync": "Crosshair",
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
            "variables": [VM_VARIABLE, JOB_VARIABLE, CLUSTER_VARIABLE],
        },
    }


# Alert rules have no dashboard variables, so they pin the production job.
ALERT_JOB = 'job="arona"'

# (uid, title, expr, operator, threshold, for, severity, summary). Each
# expression yields one series per alerting dimension, compared against
# the threshold after a last-value reduce.
ALERTS = [
    ("arona-down", "Bot down", f"absent_over_time(uptime_seconds{{{ALERT_JOB}}}[5m])", "gt", 0, "2m", "critical", "Arona has not pushed metrics for 5 minutes."),
    (
        # Fewer clusters pushing than configured: one is dead or stuck
        # respawning while the rest keep `arona-down` quiet.
        "arona-cluster-down",
        "Cluster down",
        f"max(last_over_time(cluster_count{{{ALERT_JOB}}}[1h])) - count(max by (cluster) (last_over_time(uptime_seconds{{{ALERT_JOB}}}[3m])))",
        "gt",
        0,
        "2m",
        "critical",
        "{{ $values.B.Value }} cluster(s) have not pushed metrics for 3 minutes.",
    ),
    (
        "arona-job-stale",
        "Job stale",
        f"(time() - max by (name, cluster) (job_last_success_timestamp_seconds{{{ALERT_JOB}}})) - max by (name, cluster) (2 * job_interval_seconds{{{ALERT_JOB}}} + 300)",
        "gt",
        0,
        "0s",
        "warning",
        "Job {{ $labels.name }} on cluster {{ $labels.cluster }} has not succeeded for over two of its periods.",
    ),
    ("arona-job-failures", "Job failing", f"sum by (name) (increase(job_failures_total{{{ALERT_JOB}}}[1h]))", "gt", 0, "0s", "warning", "Job {{ $labels.name }} threw in the last hour."),
    ("arona-invalid-requests", "Invalid request ban risk", f"sum(discord_rest_invalid_requests{{{ALERT_JOB}}})", "gt", 5000, "0s", "critical", "Over half of Discord's 10,000 invalid requests per 10 minutes used; the IP ban is near."),
    ("arona-rate-limits", "Sustained rate limiting", f"sum(increase(discord_rest_rate_limits_total{{{ALERT_JOB}}}[10m]))", "gt", 50, "10m", "warning", "More than 50 requests per 10 minutes are queueing behind rate limits."),
    ("arona-expired-interactions", "Interactions expiring", f"sum(increase(discord_interactions_expired_total{{{ALERT_JOB}}}[15m]))", "gt", 3, "0s", "warning", "Several interactions in 15 minutes were answered after Discord's 3s window."),
    (
        "arona-event-loop",
        "Event loop blocked",
        f"histogram_quantile(0.95, sum by (cluster, le) (rate(event_loop_ms_bucket{{{ALERT_JOB}}}[5m])))",
        "gt",
        200,
        "10m",
        "warning",
        "Cluster {{ $labels.cluster }} event loop p95 delay has been above 200ms for 10 minutes.",
    ),
    ("arona-db-pool", "Database pool exhausted", f'max by (cluster) (db_pool_connections{{{ALERT_JOB},state="waiting"}})', "gt", 0, "5m", "warning", "Cluster {{ $labels.cluster }} queries have been waiting on a Postgres connection for 5 minutes."),
    ("arona-heap", "Heap near limit", f"max by (cluster) (process_ram_used{{{ALERT_JOB}}} / process_ram_total{{{ALERT_JOB}}})", "gt", 0.9, "10m", "warning", "Cluster {{ $labels.cluster }} heap use has been above 90% of the limit for 10 minutes."),
]


def alert_rule(uid: str, title: str, expr: str, op: str, threshold: float, pending: str, severity: str, summary: str) -> dict:
    return {
        "uid": uid,
        "title": title,
        "condition": "C",
        "data": [
            {
                "refId": "A",
                "relativeTimeRange": {"from": 600, "to": 0},
                "datasourceUid": VM_VARIABLE["spec"]["current"]["value"],
                "model": {"expr": expr, "instant": True, "range": False, "queryType": "MetricsQL", "refId": "A"},
            },
            {
                "refId": "B",
                "datasourceUid": "__expr__",
                "model": {"type": "reduce", "expression": "A", "reducer": "last", "settings": {"mode": "dropNN"}, "refId": "B"},
            },
            {
                "refId": "C",
                "datasourceUid": "__expr__",
                "model": {"type": "threshold", "expression": "B", "conditions": [{"evaluator": {"type": op, "params": [threshold]}}], "refId": "C"},
            },
        ],
        # Every query here is empty while healthy (an absent series, or a
        # counter that never moved), so no data must not page.
        "noDataState": "OK",
        "execErrState": "Error",
        "for": pending,
        "annotations": {"summary": summary},
        "labels": {"severity": severity},
        "isPaused": False,
    }


def build_alerts() -> dict:
    return {
        "apiVersion": 1,
        "groups": [{"orgId": 1, "name": "arona", "folder": "Arona", "interval": "1m", "rules": [alert_rule(*a) for a in ALERTS]}],
    }


if __name__ == "__main__":
    dashboard = build()
    OUT.write_text(json.dumps(dashboard, indent=2) + "\n")
    print(f"wrote {OUT}")
    ALERTS_OUT.write_text(json.dumps(build_alerts(), indent=2) + "\n")
    print(f"wrote {ALERTS_OUT}")
