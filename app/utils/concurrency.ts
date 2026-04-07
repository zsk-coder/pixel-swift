/**
 * Concurrency utility functions
 */

/**
 * Runs a list of async task factories with a concurrency limit.
 *
 * @param tasks An array of functions, each returning a Promise (the task).
 * @param limit The maximum number of tasks to run concurrently.
 * @returns A Promise that resolves with an array of the results of all tasks.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number = 3,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < tasks.length) {
      const taskIndex = currentIndex++;
      const task = tasks[taskIndex];
      if (task) {
        results[taskIndex] = await task();
      }
    }
  }

  const workers = [];
  const concurrency = Math.min(limit, tasks.length);
  for (let i = 0; i < concurrency; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return results;
}
