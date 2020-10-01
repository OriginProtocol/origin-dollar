// Upgrade script
//
// Usage:
//  - Setup your environment
//      export BUIDLER_NETWORK=mainnet
//      export PROVIDER_URL=<url>
//  - Run:
//      node upgradeToCoreAdmin.js
//

const { ethers, getNamedAccounts } = require("@nomiclabs/buidler");

const { isMainnet, isRinkeby, proposeArgs } = require("../../test/helpers.js");

const { getTxOpts } = require("../../utils/tx");

const { utils } = require("ethers");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

// Mainnet UNISWAP pair for the swap
const UNISWAP_PAIR_FOR_HOOK = "0xcc01d9d54d06b6a0b6d09a9f79c3a6438e505f71";

function format(f) {
  const format = "json";
  return JSON.stringify({
    type: "function",
    name: f.name,
    constant: f.constant,
    stateMutability:
      f.stateMutability !== "nonpayable" ? f.stateMutability : undefined,
    payable: f.payable,
    gas: f.gas ? f.gas.toNumber() : undefined,
    inputs: f.inputs.map((input) => JSON.parse(input.format(format))),
    outputs: f.outputs.map((output) => JSON.parse(output.format(format))),
  });
}

function getFunctionsAbi(contract) {
  return (
    "[" +
    Object.values(contract.interface.functions)
      .map((f) => format(f))
      .join(",") +
    "]"
  );
}

// sleep for execute
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const vaultProxy = await ethers.getContract("VaultProxy");
  const vaultG = await ethers.getContractAt("Governable", vaultProxy.address);
  const tokenG = await ethers.getContractAt(
    "Governable",
    (await ethers.getContract("OUSDProxy")).address
  );
  const strategyG = await ethers.getContractAt(
    "Governable",
    (await ethers.getContract("CompoundStrategyProxy")).address
  );
  const minuteTimelock = await ethers.getContract("MinuteTimelock");
  const vaultCore = await ethers.getContract("VaultCore");
  const pVaultCore = await ethers.getContractAt(
    "VaultCore",
    vaultProxy.address
  );
  const pVaultAdmin = await ethers.getContractAt(
    "VaultAdmin",
    vaultProxy.address
  );
  const rebaseHooks = await ethers.getContract("RebaseHooks");

  const vaultAdmin = await ethers.getContract("VaultAdmin");

  const governor = await ethers.getContract("Governor");

  const args = await proposeArgs([
    {
      contract: vaultG,
      signature: "claimGovernance()",
    },
    {
      contract: tokenG,
      signature: "claimGovernance()",
    },
    {
      contract: strategyG,
      signature: "claimGovernance()",
    },
    {
      contract: rebaseHooks,
      signature: "claimGovernance()",
    },
    {
      contract: vaultProxy,
      signature: "upgradeTo(address)",
      args: [vaultCore.address], // Do not use MockVault on live deploy!
    },
    {
      contract: pVaultCore,
      signature: "setAdminImpl(address)",
      args: [vaultAdmin.address],
    },
    {
      contract: pVaultAdmin,
      signature: "setRebaseHooksAddr(address)",
      args: [rebaseHooks.address],
    },
    {
      contract: rebaseHooks,
      signature: "setUniswapPairs(address[])",
      args: [[UNISWAP_PAIR_FOR_HOOK]],
    },
  ]);

  const { governorAddr, deployerAddr } = await getNamedAccounts();
  const sGovernor = ethers.provider.getSigner(governorAddr);
  const sDeployer = ethers.provider.getSigner(deployerAddr);

  const description = "Take control of all services and do upgrade";
  const lastProposalId = await governor.proposalCount();
  console.log("lastProposalId=", lastProposalId.toString());

  console.log("Calling propose on governor", governor.address);
  let transaction;
  transaction = await governor
    .connect(sDeployer)
    .propose(...args, description, await getTxOpts());
  await ethers.provider.waitForTransaction(transaction.hash, NUM_CONFIRMATIONS);
  console.log("propose confirmed");

  const proposalId = await governor.proposalCount();
  console.log("proposalId=", proposalId.toString());

  if (proposalId.toString() === lastProposalId.toString()) {
    console.log("Proposal Id unchanged!");
    return;
  }

  console.log("\n=========================");
  console.log(`Governor ${governor.address}`);
  console.log("=========================");
  console.log(`ABI:`);
  console.log(getFunctionsAbi(governor));

  console.log(`====== call queue(${proposalId}) =========`);

  if (process.env.TEST_MAINNET || isRinkeby || process.env.EXECUTE_FOR_VERIFY) {
    console.log("doing actual call on network");
    let sGuardian = sGovernor;

    if (process.env.TEST_MAINNET) {
      const multiSig = "0xe011fa2a6df98c69383457d87a056ed0103aa352";
      const signers = await ethers.getSigners();
      //we need to give the multisig some ether!
      await signers[0].sendTransaction({
        to: multiSig,
        value: utils.parseEther("1"),
      });
      sGuardian = ethers.provider.getSigner(multiSig);
    }

    console.log(`Confirmed and queued on Governor`);
    await governor.connect(sGuardian).queue(proposalId, await getTxOpts());

    console.log("sleeping for 61 seconds...");
    await sleep(61000);
    transaction = await governor
      .connect(sDeployer)
      .execute(proposalId, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Confirmed proposal execution");

    //This is the last call in the chain so we can verify that this is set
    console.log("minuteTimlock:", minuteTimelock.address);
    console.log("vault Governor is:", await vaultG.governor());
    console.log("Rebase hooks pairs:", await rebaseHooks.uniswapPairs(0));
  }
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
