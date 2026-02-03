# Open Questions (UNKNOWN items)

1) Cross-chain strategy contracts in Branch B
- UNKNOWN: CrossChainMasterStrategy, CrossChainRemoteStrategy, AbstractCCTPIntegrator, CrossChainStrategyHelper are not present in Branch B (expected under contracts/contracts/strategies/crosschain/*).
- Evidence missing: no contracts/contracts/strategies/crosschain directory in Branch B (expected CrossChainMasterStrategy.sol, CrossChainRemoteStrategy.sol, AbstractCCTPIntegrator.sol, CrossChainStrategyHelper.sol).

2) Cross-chain deployment scripts in Branch B
- UNKNOWN: Create2 proxy + cross-chain strategy deploy scripts are not present in Branch B (expected contracts/deploy/mainnet/165_crosschain_strategy_proxies.js, contracts/deploy/mainnet/166_crosschain_strategy.js, contracts/deploy/base/040_crosschain_strategy_proxies.js, contracts/deploy/base/041_crosschain_strategy.js).

3) CCTP configuration in Branch B
- UNKNOWN: cctpDomainIds and CCTP config file is not present in Branch B (expected contracts/utils/cctp.js).

If these files exist in a different location or are renamed, provide the updated paths.
