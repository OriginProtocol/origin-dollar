# Interface Changes

## New interfaces (Option 1)
- ILockbox
  - depositOUSD(amount, destinationChain, recipient)
  - redeemOUSD(amount, sourceChain, recipient)
- IBridgedToken
  - mint(to, amount)
  - burn(from, amount)

## Existing interfaces to avoid changing
- IVault: keep as-is to preserve Phase 2 behavior (report_ousdv2/summary/key_invariants.md; contracts/contracts/interfaces/IVault.sol).
- OUSD: keep onlyVault mint/burn unless Option 3 is selected (contracts/contracts/token/OUSD.sol:414-434).

## Additional interfaces for Option 5
- IHubCreditManager
  - setChainCredit(chainId, credit)
  - reportMint(chainId, amount)
  - reportWithdrawal(chainId, amount)
- IRebaseSyncer
  - publishRebase(newCreditsPerToken, totalSupply)
  - applyRebase(chainId, newCreditsPerToken, totalSupply)
