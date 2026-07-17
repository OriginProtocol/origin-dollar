const fs = require("fs");
const path = require("path");

// When KV_STORE_DIR is set (talos runner sets it to the EFS mount at
// /var/talos/kv), every kv file collapses into that flat directory by
// basename so the JSON state survives Fargate task replacement.
// Without the env var (local hardhat / fork dev) we keep the original
// `_storePath` semantics so test runs don't touch a shared dir.
function resolveStorePath(storePath) {
  const root = process.env.KV_STORE_DIR;
  return root ? path.join(root, path.basename(storePath)) : storePath;
}

const keyValueStoreLocalClient = ({ _storePath }) => ({
  storePath: resolveStorePath(_storePath),

  async get(key) {
    return this.getStore()[key];
  },

  async put(key, value) {
    this.updateStore((store) => {
      store[key] = value;
    });
  },

  async del(key) {
    this.updateStore((store) => {
      delete store[key];
    });
  },

  getStore() {
    try {
      if (!fs.existsSync(this.storePath)) {
        return {};
      }
      const contents = fs.readFileSync(this.storePath, "utf8");
      return contents ? JSON.parse(contents) : {};
    } catch (error) {
      return {};
    }
  },

  updateStore(updater) {
    const store = this.getStore();
    updater(store);
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2));
  },
});

module.exports = {
  keyValueStoreLocalClient,
};
