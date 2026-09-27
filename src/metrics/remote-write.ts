import snappy from "snappyjs";
import type { HistogramValue } from "./histogram";
import { type MetricKind } from "./metric";

/**
 * Minimal Protobuf encoder for the subset of the remote-write wire format
 * VictoriaMetrics accepts: `WriteRequest` → `TimeSeries[]` → `Sample[]` +
 * `Label[]`. Field numbers are fixed by the prompb schema:
 *
 * - `Label`   : name=1, value=2
 * - `LabelPair`: name=1, value=2
 * - `Sample`  : value=1, timestamp=2
 * - `TimeSeries`: labels=1, samples=2
 * - `WriteRequest`: timeseries=1
 *
 * Protobuf varints use a low-bit continuation encoding; this tiny writer
 * keeps the exporter dependency-free (snappyjs only).
 */
function encodeVarint(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  out.push(v);
  return Uint8Array.from(out);
}

function encodeTag(field: number, wireType: number): Uint8Array {
  return encodeVarint((field << 3) | wireType);
}

function encodeBytes(field: number, data: Uint8Array): Uint8Array {
  const tag = encodeTag(field, 2);
  const len = encodeVarint(data.length);
  const out = new Uint8Array(tag.length + len.length + data.length);
  out.set(tag, 0);
  out.set(len, tag.length);
  out.set(data, tag.length + len.length);
  return out;
}

function encodeString(field: number, value: string): Uint8Array {
  return encodeBytes(field, new TextEncoder().encode(value));
}

/** Encode a label pair (name=1, value=2). */
function encodeLabel(name: string, value: string): Uint8Array {
  return concat(encodeString(1, name), encodeString(2, value));
}

/** Encode a sample message: value=1 (fixed64 double), timestamp=2 (varint). */
function encodeSample(value: number, timestampMs: number): Uint8Array {
  const valueBytes = new Uint8Array(8);
  new DataView(valueBytes.buffer).setFloat64(0, value, true); // little-endian
  return encodeBytes(
    2,
    concat(concat(encodeTag(1, 1), valueBytes), encodeVarintField(2, BigInt(timestampMs)))
  );
}

function encodeVarintField(field: number, value: bigint): Uint8Array {
  const b64 = BigInt.asUintN(64, value);
  const bytes: number[] = [];
  let v = b64;
  while (v > 0x7fn) {
    bytes.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  bytes.push(Number(v));
  return concat(encodeTag(field, 0), Uint8Array.from(bytes));
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Serialize one sample family (a single metric) into prompb TimeSeries. */
function familyToTimeSeries(
  name: string,
  kind: MetricKind,
  value: number | HistogramValue,
  labels: Record<string, string>,
  timestampMs: number
): Uint8Array {
  // TimeSeries.repeated Label labels = 1: each label is a length-delimited
  // field-1 submessage inside the TimeSeries message.
  const baseLabels = Object.entries(labels).map(([k, v]) => encodeBytes(1, encodeLabel(k, v)));

  switch (kind) {
    case "gauge": {
      const typed = value as number;
      const ts = concat(
        ...baseLabels,
        encodeBytes(1, encodeLabel("__name__", name)),
        encodeSample(typed, timestampMs)
      );
      return encodeBytes(1, ts);
    }
    case "histogram": {
      const typed = value as HistogramValue;
      const out: Uint8Array[] = [];
      // cumulative buckets
      let cumulative = 0;
      for (let i = 0; i < typed.buckets.length; i++) {
        cumulative += typed.counts[i] ?? 0;
        out.push(
          encodeBytes(
            1,
            concat(
              ...baseLabels,
              encodeBytes(1, encodeLabel("__name__", `${name}_bucket`)),
              encodeBytes(1, encodeLabel("le", String(typed.buckets[i]))),
              encodeSample(cumulative, timestampMs)
            )
          )
        );
      }
      // +Inf bucket
      out.push(
        encodeBytes(
          1,
          concat(
            ...baseLabels,
            encodeBytes(1, encodeLabel("__name__", `${name}_bucket`)),
            encodeBytes(1, encodeLabel("le", "+Inf")),
            encodeSample(typed.count, timestampMs)
          )
        )
      );
      // _sum and _count
      out.push(
        encodeBytes(
          1,
          concat(
            ...baseLabels,
            encodeBytes(1, encodeLabel("__name__", `${name}_sum`)),
            encodeSample(typed.sum, timestampMs)
          )
        )
      );
      out.push(
        encodeBytes(
          1,
          concat(
            ...baseLabels,
            encodeBytes(1, encodeLabel("__name__", `${name}_count`)),
            encodeSample(typed.count, timestampMs)
          )
        )
      );
      return concat(...out);
    }
  }
}

/**
 * Turn a manager snapshot into a remote-write payload (snappy-compressed
 * prompb `WriteRequest`). Shared by the exporter, testable in isolation.
 */
export function encodePushPayload(
  snapshot: Array<{ id: string; kind: MetricKind; value: unknown }>,
  labels: Record<string, string>,
  timestampMs = Date.now()
): Uint8Array {
  const families = snapshot.map(entry =>
    familyToTimeSeries(entry.id, entry.kind, entry.value as never, labels, timestampMs)
  );
  const payload = concat(...families);
  return snappy.compress(payload);
}
