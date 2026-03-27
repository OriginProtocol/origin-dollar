import fs from "node:fs";
import path from "node:path";

export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

// TODO: Replace with persistent KV storage.

/**
 * File-based key-value store, compatible with the Defender KeyValueStoreClient
 * interface. Reuses the pattern from contracts/utils/defender.js.
 *
 * Persists to actions/.store/{name}.json
 */
export function createStore(name: string): KeyValueStore {
  const storeDir = path.resolve(__dirname, "../../.store");
  const storePath = path.join(storeDir, `${name}.json`);

  function getStore(): Record<string, string> {
    try {
      if (!fs.existsSync(storePath)) return {};
      const contents = fs.readFileSync(storePath, "utf8");
      return contents ? JSON.parse(contents) : {};
    } catch {
      return {};
    }
  }

  function updateStore(updater: (store: Record<string, string>) => void) {
    const store = getStore();
    updater(store);
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  }

  return {
    async get(key: string) {
      return getStore()[key];
    },
    async put(key: string, value: string) {
      updateStore((store) => {
        store[key] = value;
      });
    },
    async del(key: string) {
      updateStore((store) => {
        delete store[key];
      });
    },
  };
}
