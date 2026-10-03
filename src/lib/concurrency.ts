/**
 * Run `task` over `items` with at most `limit` in flight, then resolve once
 * every item has been processed. Order is not preserved: workers pull from a
 * shared queue, so which items run together is unspecified.
 *
 * Rejections are not handled here. A task that can fail must catch its own
 * error, or it rejects the returned promise while the other workers keep
 * running.
 */
export async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(Math.max(1, limit), queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await task(item);
    }
  });
  await Promise.all(workers);
}
