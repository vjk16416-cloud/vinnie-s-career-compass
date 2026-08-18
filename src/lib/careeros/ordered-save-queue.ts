class SaveQueueResetError extends Error {
  constructor() {
    super("CareerOS save queue was reset");
    this.name = "SaveQueueResetError";
  }
}

export function createOrderedSaveQueue<T>(save: (value: T) => Promise<void>) {
  let tail: Promise<void> = Promise.resolve();
  let failed: unknown = null;
  let generation = 0;

  return {
    enqueue(value: T): Promise<void> {
      const queuedGeneration = generation;
      const next = tail.then(async () => {
        if (queuedGeneration !== generation) throw new SaveQueueResetError();
        if (failed) throw failed;

        try {
          await save(value);
        } catch (error) {
          if (queuedGeneration === generation) failed = error;
          throw error;
        }
      });

      tail = next.catch(() => undefined);
      return next;
    },
    reset() {
      generation += 1;
      failed = null;
    },
  };
}
