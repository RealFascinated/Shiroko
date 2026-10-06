export class DuplicateMetricError extends Error {
  public constructor(id: string) {
    super(`Metric "${id}" is already registered`);
    this.name = "DuplicateMetricError";
  }
}
