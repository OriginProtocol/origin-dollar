# Token Unit Tests

All token logic (rebasing, transfers, allowances, yield delegation, etc.) is tested
comprehensively in the **OUSD/** test suite, since OUSD is the base contract for all
Origin rebasing tokens.

The other token contracts (OETH, OETHBase, OSonic) only override `name()`, `symbol()`,
and `decimals()` — their test suites verify these naming overrides return the correct values.

Similarly, all ERC4626 vault logic (deposit, mint, withdraw, redeem, share pricing,
donation immunity, adjuster mechanism, etc.) is tested comprehensively in the **WOETH/**
test suite, since WOETH is the base contract for all Origin wrapped tokens.

The other wrapped token contracts (WOETHBase, WOETHPlume, WOSonic, WrappedOusd) only
override `name()` and `symbol()` — their test suites verify these naming overrides and
include basic deposit/redeem roundtrip and donation immunity tests against their
respective underlying rebasing tokens.
