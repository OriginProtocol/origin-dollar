module.exports = {
  hooks: {
    readPackage(pkg) {
      // v1.50.1 publishes an unresolved catalog entry. Match the upstream release:
      // https://github.com/ChainSafe/lodestar/blob/v1.50.1/pnpm-workspace.yaml
      if (
        pkg.name === "@lodestar/state-transition" &&
        pkg.version === "1.50.1" &&
        pkg.dependencies?.["@chainsafe/lodestar-z"] === "catalog:"
      ) {
        pkg.dependencies["@chainsafe/lodestar-z"] = "2.0.0";
      }
      return pkg;
    },
  },
};
