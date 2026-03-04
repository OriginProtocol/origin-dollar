# Token Unit Tests

All token logic (rebasing, transfers, allowances, yield delegation, etc.) is tested
comprehensively in the **OUSD/** test suite, since OUSD is the base contract for all
Origin rebasing tokens.

The other token contracts (OETH, OETHBase, OSonic) only override `name()`, `symbol()`,
and `decimals()` — their test suites verify these naming overrides return the correct values.
