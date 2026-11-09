import type { FeatureIds } from "./feature-ids";

/**
 * The data feature gating and feature settings need, kept in a leaf module so
 * they do not have to import the `Feature` class, which imports the event bus.
 */
export interface FeatureMetadata {
  readonly id: FeatureIds;
  readonly name: string;
  readonly emoji: string;
  readonly toggleable: boolean;
  readonly defaultEnabled: boolean;
}

const REGISTRY: Map<FeatureIds, FeatureMetadata> = new Map<FeatureIds, FeatureMetadata>();

export function registerFeatureMetadata(metadata: FeatureMetadata): void {
  REGISTRY.set(metadata.id, metadata);
}

export function getFeatureMetadata(id: FeatureIds): FeatureMetadata | undefined {
  return REGISTRY.get(id);
}

export function allFeatureMetadata(): FeatureMetadata[] {
  return [...REGISTRY.values()];
}
