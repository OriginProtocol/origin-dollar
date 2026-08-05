# On-chain verification cookbook (trust-but-verify the MCP)

Every command below was tested live (2026-07-16) and returned sensible values. Run from `contracts/`. We do **not** fully trust the MCP: it can be stale, it can't show cross-chain utilization, and a coworker's skill shipped a real bug by proxying deployed balance with `maxPossibleAmount`. These reads are the independent check.

## RPCs (in `contracts/.env`)
```
RPC_ETH=$(grep -E "^PROVIDER_URL="          .env | head -1 | cut -d= -f2- | tr -d ' "')
RPC_BASE=$(grep -E "^BASE_PROVIDER_URL="    .env | head -1 | cut -d= -f2- | tr -d ' "')
RPC_HYPE=$(grep -E "^HYPEREVM_PROVIDER_URL=" .env | head -1 | cut -d= -f2- | tr -d ' "')
```
All three verified working (`cast chain-id` → 1 / 8453 / 999).

## Addresses
| What | Address |
|---|---|
| OUSD VaultProxy | `0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70` |
| USDC (mainnet) | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Strat: Curve AMO | `0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11` |
| Strat: Morpho OUSD v2 (mainnet) | `0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e` |
| Strat: CrossChain Base master | `0xB1d624fc40824683e2bFBEfd19eB208DbBE00866` |
| Strat: CrossChain HyperEVM master | `0xE0228DB13F8C4Eb00fD1e08e076b09eF5cD0EA1e` |
| Morpho Blue (mainnet & Base) | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Morpho Blue (HyperEVM) | `0x68e37dE8d93d3496ae143F2E900490f6280C57cD` |
| MetaMorpho V1 vault (mainnet) | `0x5B8b9FA8e4145eE06025F642cAdB1B47e5F39F04` |
| MetaMorpho V1 vault (Base) | `0x581Cc9a73Ec7431723A4a80699B8f801205841F1` |
| MetaMorpho V1 vault (HyperEVM) | `0x0fb7e41A0A85Eb0BcA55172b73942cc6685e2B2E` |
| Vault V2 (mainnet) | `0xFB154c729A16802c4ad1E8f7FF539a8b9f49c960` |
| Vault V2 (Base) | `0x2Ba14b2e1E7D2189D3550b708DFCA01f899f33c1` |
| Vault V2 (HyperEVM) | `0xE90959cbE7E56b5eBFF9AD12de611A4976F2d2B1` |
| Mainnet OETH/USDC marketId | `0xb8fef900b383db2dbbf4458c7f46acf5b140f26d603a6d1829963f241b82510e` |
| Adaptive Curve IRM (mainnet) | `0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC` |

Architecture: strategy → **Vault V2** → adapter → **MetaMorpho V1** → **Morpho Blue** markets. The V1 spreads funds across several Blue markets (3 on HyperEVM), so util must be read per-market.

## 1. Freshness — is the MCP stale?
```bash
cast block-number --rpc-url "$RPC_ETH"     # compare vs the MCP's reported blockNumber
```
If the MCP is far behind chain head, distrust its APY/util/liquidity.

## 2. True deployed balance (fixes the `maxPossibleAmount` bug)
```bash
cast call 0x3643...FFf6e "checkBalance(address)(uint256)" 0xA0b8...eB48 --rpc-url "$RPC_ETH"   # strategy view
cast call 0xFB15...c960 "totalAssets()(uint256)" --rpc-url "$RPC_ETH"                            # V2 vault, cross-check
```
Verified: both ≈ $3,576,0xx (1e6). The MCP's `maxPossibleAmount` for chain 1 was $1.31M — a **withdrawal ceiling (market liquidity), not the deployed $3.576M**. Never use it as balance.

## 3. Real utilization + available liquidity (any chain) — the key check
`Morpho.market(id)` returns `(totalSupplyAssets, totalSupplyShares, totalBorrowAssets, totalBorrowShares, lastUpdate, fee)` — fields 1 & 3 are USDC (1e6).
```bash
# enumerate the V1 vault's markets, then read each
LEN=$(cast call <V1_VAULT> "withdrawQueueLength()(uint256)" --rpc-url "$RPC")
for i in $(seq 0 $((LEN-1))); do
  MID=$(cast call <V1_VAULT> "withdrawQueue(uint256)(bytes32)" $i --rpc-url "$RPC" | tr -d '[:space:]')
  RAW=$(cast call <MORPHO_BLUE> "market(bytes32)(uint256,uint256,uint256,uint256,uint256,uint256)" "$MID" --rpc-url "$RPC")
  SUP=$(echo "$RAW" | sed -n '1p' | grep -oE '^[0-9]+')
  BOR=$(echo "$RAW" | sed -n '3p' | grep -oE '^[0-9]+')
  python3 -c "print(f'mkt $i util={$BOR/$SUP*100:.2f}%  liquidity=\${($SUP-$BOR)/1e6:,.0f}')"
done
```
> Parse with `sed -n` + `grep -oE '^[0-9]+'` — cast's `[1.2e3]` annotations break naive whitespace splitting (this bit me; got wrong util until fixed).

Verified live:
- Mainnet OETH/USDC: util **90.00%**, liquidity **$919,504** — matches MCP. ✓
- HyperEVM (markets we hold): util **~91.7%**, so its ~10.5% APY is an **above-target spike** (MCP could not reveal this).

**Use:** util > 90% ⇒ discount that bucket's APY to its ~90%-util sustainable level. A withdrawal `x` must satisfy `x ≤ Σ available` across our markets or it's partial. Post-move util sanity: `borrow/(supply − x) ≤ 0.90`.

## 4. Our per-market position (how much is pullable where)
```bash
cast call <MORPHO_BLUE> "position(bytes32,address)(uint256,uint128,uint128)" <MID> <V1_VAULT> --rpc-url "$RPC"
# supplyShares (field 1); assets = supplyShares * totalSupplyAssets / totalSupplyShares
```

## Gotchas (verified)
- **`maxWithdraw`/`maxDeposit` on Vault-V2 return 0** — non-standard ERC4626 semantics here. Do not use; use Blue market liquidity (§3).
- The V1 vault holds **multiple markets** (`withdrawQueueLength` = 3 on HyperEVM); `withdrawQueue[0]` may be a tiny/idle market — always enumerate all, weight by our position.
- Ethereum `simulate_morpho_max_withdrawal` often returns $0 due to the **wstETH/OETH spread floor** even when util is low — confirm the real withdrawable with `simulate_morpho_action(withdraw,...)` and the on-chain liquidity read.
