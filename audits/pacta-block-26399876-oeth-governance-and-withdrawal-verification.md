# Origin OETH Governance & Withdrawal-Queue Verification (Block 26399876)

- **Protocol**: Origin Protocol (`OriginProtocol/origin-dollar`)
- **Pinned Block**: Ethereum Mainnet Block `26399876` (`0x44f58f4f95957166ca60c99a0f1d8fb4fa165787ff3be0183a00f74a342a2d7b`)
- **Auditor**: Pacta — Protocol Commitments DRI ([Fractal Neurons](https://fractalneurons.com)) · [`Fractal-Neurons/pacta`](https://github.com/Fractal-Neurons/pacta) · `pacta@dri.network`

---

## 1. Summary of Finding `O8` (Documentation vs. Live Native Withdrawal Queue Architecture)

Origin OETH documentation (Security / Parameters) still references an external `AutoWithdrawalModule` operated by the 2-of-8 Guardian Multisig (`0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC`).

On-chain at block `26399876`, `OETHVaultProxy` (`0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab`) implements native asynchronous withdrawal queueing directly inside `OETHVaultCore` (`0x0609C88E99a54300A143252C2258268A3E36D05b`) via `requestWithdrawal(uint256)` and `claimWithdrawal(uint256)`:
- `governor()` is the 48-hour `Timelock` (`0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F`, `getMinDelay() == 172800`).
- `strategistAddr()` is the 2-of-8 Guardian Multisig (`0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC`, `getThreshold() == 2`, `getOwners().length == 8`).

---

## 2. Deterministic Reproduction (`cast`)

```bash
RPC_URL="https://eth.drpc.org"
BLOCK=26399876
OETH_VAULT="0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab"
TIMELOCK="0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F"
GUARDIAN_SAFE="0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC"

# 1. Verify OETHVaultProxy governor (48h Timelock) and strategistAddr (2-of-8 Guardian Safe)
cast call $OETH_VAULT "governor()(address)" --block $BLOCK --rpc-url $RPC_URL
cast call $OETH_VAULT "strategistAddr()(address)" --block $BLOCK --rpc-url $RPC_URL
cast call $TIMELOCK "getMinDelay()(uint256)" --block $BLOCK --rpc-url $RPC_URL

# 2. Verify Guardian Safe threshold (2) and owner count (8)
cast call $GUARDIAN_SAFE "getThreshold()(uint256)" --block $BLOCK --rpc-url $RPC_URL
cast call $GUARDIAN_SAFE "getOwners()(address[])" --block $BLOCK --rpc-url $RPC_URL
```
