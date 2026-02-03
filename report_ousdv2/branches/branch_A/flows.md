# Branch A Flow-of-Funds (Phase 2)

## 1) Mainnet mint (USDC in -> OUSD out)
- User mints via VaultCore.mint(asset, amount, min) which calls _mint, mints OUSD, and transfers the asset into the Vault (contracts/contracts/vault/VaultCore.sol:61-107).
- Rebase can be triggered before transfers when the mint exceeds rebaseThreshold (contracts/contracts/vault/VaultCore.sol:97).
- Event: Mint (contracts/contracts/vault/VaultStorage.sol:27).

## 2) Allocation decision (how much to each chain)
- Governor/Strategist sets per-asset default strategy via setAssetDefaultStrategy (contracts/contracts/vault/VaultAdmin.sol:111).
- VaultCore._allocate iterates allAssets and sends excess asset to assetDefaultStrategies[asset] (contracts/contracts/vault/VaultCore.sol:321-346; contracts/contracts/vault/VaultStorage.sol:147,100).
- Event: AssetAllocated (contracts/contracts/vault/VaultStorage.sol:24).

## 3) Cross-chain dispatch (CCTP)
- Vault allocates to CrossChainMasterStrategy.deposit (onlyVault) (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:83).
- _deposit sets pendingAmount and advances nonce (pendingAmount, lastTransferNonce) (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:250; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:588).
- Payload encoded with CrossChainStrategyHelper.encodeDepositMessage (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:253; contracts/contracts/strategies/crosschain/CrossChainStrategyHelper.sol:107).
- _sendTokens calls CCTP depositForBurnWithHook (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:359-391).
- Events: Deposit (contracts/contracts/utils/InitializableAbstractStrategy.sol:20) and TokensBridged (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:33).

## 4) Destination-chain handling
- Operator relays CCTP message via AbstractCCTPIntegrator.relay, which validates sender/recipient/domain and calls receiveMessage (contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:433-523).
- Remote strategy handles the deposit hook in _onTokenReceived -> _processDepositMessage (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:342-355,170-199).
- _processDepositMessage marks nonce processed and deposits into ERC-4626 via _deposit (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:179-189,206-221).
- It then sends a balance check message back to the master via _sendMessage (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:191-199; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:408).
- Events: Deposit or DepositUnderlyingFailed depending on ERC-4626 call success (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:219-233).

## 5) Balance reporting to mainnet
- Master receives balance check in _onMessageReceived -> _processBalanceCheckMessage (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:183-190,306-347).
- If it is a transfer confirmation, it marks the nonce processed and clears pendingAmount (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:329-333).
- remoteStrategyBalance is updated and RemoteStrategyBalanceUpdated is emitted (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:345-347).

## 6) Withdrawals (mainnet -> remote -> mainnet)
- Master sends a withdraw request by encoding a withdraw message and calling _sendMessage (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:270-293; contracts/contracts/strategies/crosschain/AbstractCCTPIntegrator.sol:408).
- Event: WithdrawRequested (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:294-296).
- Remote receives the withdraw message and attempts to satisfy it; if needed, it withdraws from the ERC-4626 vault (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:241-257,300-319).
- If enough USDC is available, remote bridges tokens back with a balance check hook; otherwise it sends a balance update and emits WithdrawalFailed (contracts/contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:268-291).

## 7) Mainnet receipt and Vault credit
- Master _onTokenReceived processes the balance check payload, then transfers all USDC to the Vault and emits Withdrawal (contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:197-228).

## 8) Distribution to OUSD holders
- Vault rebase uses total value across strategies, which includes CrossChainMasterStrategy.checkBalance (contracts/contracts/vault/VaultCore.sol:549-562; contracts/contracts/strategies/crosschain/CrossChainMasterStrategy.sol:141).
- OUSD supply is increased via changeSupply (contracts/contracts/vault/VaultCore.sol:467-468; contracts/contracts/token/OUSD.sol:597).
- Event: YieldDistribution (contracts/contracts/vault/VaultStorage.sol:39).
