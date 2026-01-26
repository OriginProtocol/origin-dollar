const fs = require("fs");
const path = require("path");

const keyValueStoreLocalClient = ({ _storePath }) => ({
  storePath: _storePath,

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
