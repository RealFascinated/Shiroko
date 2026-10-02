/**
 * Thrown when a metric is registered twice under the same id.
 */
export class DuplicateMetricError extends Error {
  public constructor(id: string) {
    super(`Metric "${id}" is already registered`);
    this.name = "DuplicateMetricError";
  }
}
