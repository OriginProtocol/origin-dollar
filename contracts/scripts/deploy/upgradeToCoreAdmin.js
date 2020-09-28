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

const {
  isMainnet,
  proposeArgs,
} = require("../../test/helpers.js");


// Mainnet UNISWAP pair for the swap
const UNISWAP_PAIR_FOR_HOOK = "0xcc01d9d54d06b6a0b6d09a9f79c3a6438e505f71";

function getFunctionsAbi(contract) {
  return (
    "[" +
    Object.values(contract.interface.functions)
      .map((f) => f.format("json"))
      .join(",") +
    "]"
  );
}

function showTransfer(proxy, toAddress) {
  console.log(`===== ABI for use on: ${proxy.address} =======`);
  console.log(getFunctionsAbi(proxy));
  console.log("===== End ABI =====");
  console.log("Make multisig call:");
  console.log(`        transferGovernance(${toAddress})`);
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

  showTransfer(vaultG, minuteTimelock.address);
  showTransfer(tokenG, minuteTimelock.address);
  showTransfer(strategyG, minuteTimelock.address);

  const governor = await ethers.getContract("Governor");
  console.log(`===== ABI for use on: ${governor.address} =======`);
  console.log(getFunctionsAbi(governor));
  console.log("===== End ABI =====");

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

  const [targets, values, sigs, datas] = args;
  const description = "Take control of all services and do upgrade";

  console.log("Make multisig call:");
  console.log(
    `    proposeAndQueue(${JSON.stringify(targets)}, ${JSON.stringify(
      values
    )}, ${JSON.stringify(sigs)}, ${JSON.stringify(datas)}, ${JSON.stringify(
      description
    )})`
  );


  if (!isMainnet) {
    console.log(
      "We are not mainnet and so running against governor directly..."
    );
    const { governorAddr, deployerAddr } = await getNamedAccounts();
    const sGovernor = ethers.provider.getSigner(governorAddr);
    const sDeployer = ethers.provider.getSigner(deployerAddr);

    await vaultG.connect(sGovernor).transferGovernance(minuteTimelock.address);
    await tokenG.connect(sGovernor).transferGovernance(minuteTimelock.address);
    await strategyG
      .connect(sGovernor)
      .transferGovernance(minuteTimelock.address);

    await governor
      .connect(sGovernor)
      .proposeAndQueue(targets, values, sigs, datas, description);
    const proposalId = await governor.proposalCount();
    console.log("proposal created:", proposalId.toString());
    console.log("sleeping for 61 seconds...");
    await sleep(61000);
    await governor.connect(sDeployer).execute(proposalId);
    console.log("execute done...");
    //This is the last call in the chain so we can verify that this is set
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
