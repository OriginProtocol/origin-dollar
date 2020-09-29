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

const { utils, Contract } = require("ethers");

// Wait for 3 blocks confirmation on Mainnet/Rinkeby.
const NUM_CONFIRMATIONS = isMainnet || isRinkeby ? 3 : 0;

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

function showTransfer(proxy, toAddress, name) {
  console.log("\n=========================");
  console.log(`${name} ${proxy.address}`);
  console.log("=========================");
  console.log("ABI:");
  console.log(getFunctionsAbi(proxy));
  console.log("\nMake multisig call:");
  console.log(`        transferGovernance(`);
  console.log(`                           ${toAddress}`);
  console.log(`                          )`);
}

// sleep for execute
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const oldGovernor = process.argv[2];
  if(!oldGovernor){
    console.log("old governor address required as an argument.")
    return;
  }
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

  console.log("swapping to new MinuteTimelock:", minuteTimelock.address);
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
      contract: vaultG,
      signature: "transferGovernance(address)",
      args: [minuteTimelock.address], // Do not use MockVault on live deploy!
    },
    {
      contract: tokenG,
      signature: "transferGovernance(address)",
      args: [minuteTimelock.address], // Do not use MockVault on live deploy!
    },
    {
      contract: strategyG,
      signature: "transferGovernance(address)",
      args: [minuteTimelock.address], // Do not use MockVault on live deploy!
    },
  ]);

  const oldGovernorContract = new Contract(oldGovernor, ["function proposeAndQueue(address[],uint256[],string[],bytes[],string) public returns(uint256)", "function proposalCount() public view returns(uint256)", "function execute(uint256) public payable"], ethers.provider)
  const tx = await oldGovernorContract.populateTransaction['proposeAndQueue'](...args, "Swap to a new timelock");
  const data = tx.data;

  console.log(`===== mutliSig submitTransaction against: ${oldGovernor} ======`);
  console.log(`===== begin data ====`);
  console.log(data);
  console.log(`===== end data ======`);

  if (process.env.TEST_MAINNET || isRinkeby || process.env.EXECUTE_FOR_VERIFY) {
    console.log(
      "We are running against governor directly..."
    );
    const { governorAddr } = await getNamedAccounts();
    const sGovernor = ethers.provider.getSigner(governorAddr);

    let sGuardian = sGovernor;

    if (process.env.TEST_MAINNET)
    {
      const multiSig = '0xe011fa2a6df98c69383457d87a056ed0103aa352'
      const signers = await ethers.getSigners();
      //we need to give the multisig some ether!
      await signers[0].sendTransaction({
        to: multiSig,
        value: utils.parseEther("1"),
      });
      sGuardian = ethers.provider.getSigner(multiSig);
    }

    const sendTx = {
      from: await sGuardian.getAddress(),
      to:oldGovernor,
      data
    }

    let transaction;

    transaction = await sGuardian.sendTransaction(sendTx);
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log(`Confirmed proposeAndQueue on Governor`);

    const proposalId = await oldGovernorContract.proposalCount();
    console.log("proposal created:", proposalId.toString());
    console.log("old Governor is:", await strategyG.governor());

    console.log("sleeping for 61 seconds...");
    await sleep(61000);
    transaction = await oldGovernorContract
      .connect(sGuardian)
      .execute(proposalId, await getTxOpts());
    await ethers.provider.waitForTransaction(
      transaction.hash,
      NUM_CONFIRMATIONS
    );
    console.log("Confirmed proposal execution");

    //This is the last call in the chain so we can verify that this is set
    console.log("new Governor is:", await strategyG.governor());
  }
}

// Run the job.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
