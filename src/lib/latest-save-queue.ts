type Request<Value, Result> = {
  value: Value;
  resolve: (result: Result | null) => void;
  reject: (error: unknown) => void;
};

type Entry<Value, Result> = {
  running: boolean;
  latest: Request<Value, Result> | null;
};

export class LatestSaveQueue<Value, Result> {
  private readonly entries = new Map<string, Entry<Value, Result>>();

  constructor(private readonly persist: (key: string, value: Value) => Promise<Result>) {}

  enqueue(key: string, value: Value) {
    const entry = this.entries.get(key) ?? { running: false, latest: null };
    this.entries.set(key, entry);
    entry.latest?.resolve(null);

    const result = new Promise<Result | null>((resolve, reject) => {
      entry.latest = { value, resolve, reject };
    });

    if (!entry.running) {
      entry.running = true;
      void this.drain(key, entry);
    }

    return result;
  }

  clear(key: string) {
    const entry = this.entries.get(key);
    entry?.latest?.resolve(null);
    this.entries.delete(key);
  }

  private async drain(key: string, entry: Entry<Value, Result>) {
    while (entry.latest) {
      const request = entry.latest;
      entry.latest = null;
      try {
        request.resolve(await this.persist(key, request.value));
      } catch (error) {
        request.reject(error);
      }
    }

    entry.running = false;
    if (entry.latest) {
      entry.running = true;
      void this.drain(key, entry);
    } else if (this.entries.get(key) === entry) {
      this.entries.delete(key);
    }
  }
}
