export function createOrderedSaveQueue<T>(save: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  let failed: unknown = null;

  return {
    enqueue(value: T): Promise<void> {
      const next = tail.then(async () => {
        if (failed) throw failed;
        try {
          await save(value);
        } catch (error) {
          failed = error;
          throw error;
        }
      });
      tail = next.catch(() => undefined);
      return next;
    },
    reset() {
      failed = null;
    },
  };
}
