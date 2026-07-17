// OFFLINE proof-assembly check for the viem verifyBalances action.
//
// No beacon RPC, no tx broadcast. Builds the block/state views offline from the
// cached FULU state (cache/state_14465000.ssz), patches the block's stateRoot
// with the state node (exactly like getBeaconBlock), then exercises the SAME
// proof-assembly path used by tasks/actions-viem/verifyBalances.ts:
//   - generateBalancesContainerProof
//   - generateBalanceProof (per validator)
//   - generatePendingDepositsContainerProof
//   - generatePendingDepositProof
// and finally encodeFunctionData for verifyBalances to confirm the calldata
// encodes. Reports non-empty proofs.

import fs from "node:fs";
import { encodeFunctionData } from "viem";

// Import the proven viem proof ports and the byte helpers used by the action.
const proofs = await import("../../tasks/actions-viem/_lib/proofs.viem.ts");
const { toHex } = await import("../../tasks/actions-viem/_lib/beaconBytes.ts");

const STATE_FILE = "./cache/state_14465000.ssz";
const VALIDATOR_INDEX = 0; // present validator in the cached state

const verifyBalancesAbi = [
  {
    type: "function",
    name: "verifyBalances",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "balanceProofs",
        type: "tuple",
        components: [
          { name: "balancesContainerRoot", type: "bytes32" },
          { name: "balancesContainerProof", type: "bytes" },
          { name: "validatorBalanceLeaves", type: "bytes32[]" },
          { name: "validatorBalanceProofs", type: "bytes[]" },
        ],
      },
      {
        name: "pendingDepositProofs",
        type: "tuple",
        components: [
          { name: "pendingDepositContainerRoot", type: "bytes32" },
          { name: "pendingDepositContainerProof", type: "bytes" },
          { name: "pendingDepositIndexes", type: "uint32[]" },
          { name: "pendingDepositProofs", type: "bytes[]" },
        ],
      },
    ],
    outputs: [],
  },
];

const nonEmpty = (hex) => typeof hex === "string" && hex.length > 2;

async function main() {
  const { ssz } = await import("@lodestar/types");

  // 1. Deserialize the cached FULU state (fixes electra hardcode).
  const stateBytes = fs.readFileSync(STATE_FILE);
  const stateView = ssz.fulu.BeaconState.deserializeToView(stateBytes);
  console.log(`state slot                 : ${stateView.slot}`);
  console.log(`validators                 : ${stateView.validators.length}`);
  console.log(
    `pendingDeposits            : ${stateView.pendingDeposits.length}`
  );

  // 2. Build a synthetic FULU block view and patch its stateRoot with the state
  //    node — this is exactly what getBeaconBlock does (blockTree.setNode).
  const blockView = ssz.fulu.BeaconBlock.toView(
    ssz.fulu.BeaconBlock.defaultValue()
  );
  const blockTree = blockView.tree.clone();
  const stateRootGIndex = blockView.type.getPropertyGindex("stateRoot");
  blockTree.setNode(stateRootGIndex, stateView.node);

  // Also patch via getPathInfo(["stateRoot"]) path as the action does.
  const stateRootGindex2 = blockView.type.getPathInfo(["stateRoot"]).gindex;
  blockTree.setNode(stateRootGindex2, stateView.node);

  const beaconBlockRoot = toHex(blockTree.root);
  console.log(`patched beacon block root  : ${beaconBlockRoot}`);

  // 3. Balances container proof
  const balancesContainer = await proofs.generateBalancesContainerProof({
    blockView,
    blockTree,
    stateView,
  });
  console.log(
    `balancesContainerRoot      : ${balancesContainer.leaf} (proof bytes ${
      (balancesContainer.proof.length - 2) / 2
    })`
  );

  // 4. Per-validator balance proof
  const balanceProof = await proofs.generateBalanceProof({
    validatorIndex: VALIDATOR_INDEX,
    blockView,
    blockTree,
    stateView,
  });
  console.log(
    `validator ${VALIDATOR_INDEX} balance leaf : ${
      balanceProof.leaf
    } (proof bytes ${(balanceProof.proof.length - 2) / 2}, balance ${
      balanceProof.balance
    })`
  );

  // 5. Pending deposits container proof
  const pendingDepositsContainer =
    await proofs.generatePendingDepositsContainerProof({
      blockView,
      blockTree,
      stateView,
    });
  console.log(
    `pendingDepositContainerRoot: ${
      pendingDepositsContainer.leaf
    } (proof bytes ${(pendingDepositsContainer.proof.length - 2) / 2})`
  );

  // 6. One pending deposit proof (index 0)
  const pendingDepositProof = await proofs.generatePendingDepositProof({
    blockView,
    blockTree,
    stateView,
    depositIndex: 0,
  });
  console.log(
    `pendingDeposit[0] leaf     : ${pendingDepositProof.leaf} (proof bytes ${
      (pendingDepositProof.proof.length - 2) / 2
    })`
  );

  // 7. Assemble the exact on-chain arg shapes and encode calldata.
  const balanceProofsArg = {
    balancesContainerRoot: balancesContainer.leaf,
    balancesContainerProof: balancesContainer.proof,
    validatorBalanceLeaves: [balanceProof.leaf],
    validatorBalanceProofs: [balanceProof.proof],
  };
  const pendingDepositProofsArg = {
    pendingDepositContainerRoot: pendingDepositsContainer.leaf,
    pendingDepositContainerProof: pendingDepositsContainer.proof,
    pendingDepositIndexes: [0],
    pendingDepositProofs: [pendingDepositProof.proof],
  };

  const calldata = encodeFunctionData({
    abi: verifyBalancesAbi,
    functionName: "verifyBalances",
    args: [balanceProofsArg, pendingDepositProofsArg],
  });

  // 8. Assertions
  const checks = {
    balancesContainerProofNonEmpty: nonEmpty(balancesContainer.proof),
    validatorBalanceProofNonEmpty: nonEmpty(balanceProof.proof),
    pendingDepositContainerProofNonEmpty: nonEmpty(
      pendingDepositsContainer.proof
    ),
    pendingDepositProofNonEmpty: nonEmpty(pendingDepositProof.proof),
    calldataEncoded: nonEmpty(calldata),
    calldataSelector: calldata.slice(0, 10),
  };
  console.log("\nOFFLINE ASSEMBLY CHECKS:");
  console.log(JSON.stringify(checks, null, 2));
  console.log(`calldata length (bytes)    : ${(calldata.length - 2) / 2}`);

  const allNonEmpty =
    checks.balancesContainerProofNonEmpty &&
    checks.validatorBalanceProofNonEmpty &&
    checks.pendingDepositContainerProofNonEmpty &&
    checks.pendingDepositProofNonEmpty &&
    checks.calldataEncoded;

  console.log(`\nRESULT: ${allNonEmpty ? "PASS" : "FAIL"}`);
  if (!allNonEmpty) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
