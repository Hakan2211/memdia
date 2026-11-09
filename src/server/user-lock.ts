/**
 * In-process keyed lock: serializes async work per key (e.g. per user), so
 * read-modify-write jobs for the same user can't interleave. Fine because the
 * app runs as a single long-lived Node server.
 */

const locks = new Map<string, Promise<unknown>>()

export function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve()
  const run = previous.catch(() => {}).then(fn)
  const tail = run.catch(() => {})
  locks.set(key, tail)
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key)
  })
  return run
}

export function isLocked(key: string): boolean {
  return locks.has(key)
}
