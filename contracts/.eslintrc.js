module.exports = {
  env: {
    es2020: true,
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
  plugins: ["no-only-tests"],
  rules: {
    "no-constant-condition": ["error", { checkLoops: false }],
    "no-only-tests/no-only-tests": "error",
    "no-unused-vars": [2, { vars: "all", args: "after-used" }],
  },
  overrides: [
    {
      files: ["**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
      },
      plugins: ["@typescript-eslint"],
      extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": [
          2,
          { vars: "all", args: "after-used" },
        ],
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
  ],
};
