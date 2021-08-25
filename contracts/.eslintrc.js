module.exports = {
  env: {
    es6: true,
    node: true,
    browser: true,
    amd: true,
    mocha: true,
  },
  extends: "eslint:recommended",
  parserOptions: {
    ecmaVersion: 11,
    sourceType: "module",
  },
  globals: {
    waffle: "readable",
    ethers: "readable",
    deployments: "readable",
    getNamedAccounts: "readable",
    hre: "readable",
  },
  rules: {},
};
