# OETHb Hydrex AMO — open issues

This file tracks the loose ends from the initial Hydrex AMO PR. **Delete this
file once every item below is resolved.**

## Blockers (must clear before mainnet deploy)

- [ ] **Live Hydrex gauge address.** `addresses.base.HydrexOETHb_WETH.gauge`
  in `contracts/utils/addresses.js` is currently `0x0000…0000`. Replace with
  the real Hydrex gauge once it is deployed for the superOETHb/WETH pool.
  - Verify on-chain that it is a `GaugeV2`-shaped staking gauge (exposes
    `TOKEN()`, `deposit(uint256)`, `withdraw(uint256)`, `getReward()`,
    `emergency()`, `emergencyWithdraw()`), **not** a non-staking
    `GaugeIncentiveCampaign` (the `0xac39…9993`-style contract).
  - The deploy script `deploy/base/048_oethb_hydrex_amo.js` no-ops while the
    placeholder is in place; it will start running its full body the moment a
    non-zero gauge address is set.

- [ ] **HYDX reward token verification.** `addresses.base.HYDX` is
  `0x00000e7efa313F4E11Bfff432471eD9423AC6B30` (per docs). Once the gauge is
  live, assert `gauge.rewardToken() == addresses.base.HYDX` — ideally with a
  `require(...)` in `048_oethb_hydrex_amo.js` so a wrong address fails the
  deploy loudly.

## Cleanup once gauge is live

- [ ] **Delete the mock gauge.** Once the live gauge address is in
  `addresses.base.HydrexOETHb_WETH.gauge`, the fork-test fixture
  short-circuits to the live-gauge branch and the mock is no longer touched.
  Remove:
  - `contracts/contracts/mocks/MockHydrexGauge.sol`
  - the `_mockHydrexGaugeIfNeeded` helper in `contracts/test/_fixture-base.js`
  - the `if (hydrexGaugeIsMock)` HYDX-allowance block (also in the fixture)
  - the `hydrexGaugeIsMock` field from the fixture's return value
  - the `USING MOCK HYDREX GAUGE — replace …` warning log

  Fork tests should keep passing with no other changes.

- [ ] **Tune `scenarioConfig` magnitudes** in
  `test/strategies/base/oethb-hydrex-amo.base.fork-test.js` once the pool has
  real bootstrapped liquidity. The current numbers were sized for the
  fixture-seeded ~150 / 150 pool; live-pool numbers can probably go up.

## Nice-to-have

- [ ] Confirm the L2 initialize-time governor pattern in
  `deployOETHbHydrexAMOStrategyImplementation` (currently passes
  `addresses.base.timelock`) matches whichever convention the rest of
  `deploy/base/*` uses for proxy `initialize(impl, governor, data)` calls.
