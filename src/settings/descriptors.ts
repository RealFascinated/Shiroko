import type { FieldDescriptor } from "./settings-module";

/**
 * One boolean descriptor per key of a closed record, with per-key labels
 * and defaults. Used to describe a `Record<K, boolean>` group (log types,
 * feature toggles) without hand-writing each field.
 */
export function booleanFields<K extends string>(
  labels: Record<K, string>,
  defaults: Record<K, boolean>
): ReadonlyArray<FieldDescriptor<Record<K, boolean>>> {
  return (Object.keys(labels) as K[]).map(key => ({
    key,
    type: "boolean" as const,
    label: labels[key],
    default: defaults[key],
  }));
}
