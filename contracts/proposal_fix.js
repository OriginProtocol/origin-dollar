const { ethers } = require("hardhat");
const addresses = require("./utils/addresses");
const {
  isMainnetOrRinkebyOrFork,
  isMainnet,
  isFork,
  isRinkeby,
  getAssetAddresses,
} = require("./test/helpers.js");
const { proposeArgs } = require("./utils/governor");
const { getTxOpts } = require("./utils/tx");
const {
  executeProposal,
  sendProposal,
  withConfirmation,
} = require("./utils/deploy");

function log(msg, deployResult = null) {
  if (isMainnetOrRinkebyOrFork || process.env.VERBOSE) {
    if (deployResult && deployResult.receipt) {
      const gasUsed = Number(deployResult.receipt.gasUsed.toString());
      msg += ` Address: ${deployResult.address} Gas Used: ${gasUsed}`;
    }
    console.log("INFO:", msg);
  }
}

const generateProposal = async () => {
  const assetAddresses = await getAssetAddresses(hre.deployments);
  // Vault and OUSD contracts
  const cOUSDProxy = await ethers.getContract("OUSDProxy");
  const cOUSDImpl = await ethers.getContract("OUSD");
  const cVaultProxy = await ethers.getContract("VaultProxy");
  const cVault = await ethers.getContractAt("Vault", cVaultProxy.address);
  const cVaultCoreImpl = await ethers.getContract("VaultCore");
  const cVaultAdminImpl = await ethers.getContract("VaultAdmin");
  const cVaultCore = await ethers.getContractAt(
    "VaultCore",
    cVaultProxy.address
  );
  const cOracleRouter = await ethers.getContract("OracleRouter");
  // Buyback contract
  const cOldBuyback = await ethers.getContractAt(
    "Buyback",
    "0x7294CD3C3eb4097b03E1A61EB2AD280D3dD265e6"
  );
  const cOGN = await ethers.getContractAt("MockOGN", assetAddresses.OGN);
  const ognBalance = await cOGN.balanceOf(cOldBuyback.address);
  const cBuyback = await ethers.getContract("Buyback");
  const cCompoundStrategyProxy = await ethers.getContract(
    "CompoundStrategyProxy"
  );
  const cCompoundStrategy = await ethers.getContractAt(
    "CompoundStrategy",
    cCompoundStrategyProxy.address
  );
  const cAaveStrategyProxy = await ethers.getContract("AaveStrategyProxy");
  const cAaveStrategy = await ethers.getContractAt(
    "AaveStrategy",
    cAaveStrategyProxy.address
  );

  // Governance proposal
  return {
    name: "Deploy all new contracts and migrate all funds",
    actions: [
      {
        // Claim governance of OUSDProxy, transferred in 020_new_governor
        contract: cOUSDProxy,
        signature: "claimGovernance()",
      },
      {
        // Claim governance of cVaultProxy, transferred in 020_new_governor
        contract: cVaultProxy,
        signature: "claimGovernance()",
      },
      {
        // Claim governance of Buyback
        contract: cBuyback,
        signature: "claimGovernance()",
      },
      {
        // Claim governance of old Buyback
        contract: cOldBuyback,
        signature: "claimGovernance()",
      },
      {
        // Claim Governance of Compound strategy
        contract: cCompoundStrategy,
        signature: "claimGovernance()",
      },
      {
        // Claim Governance of Aave strategy
        contract: cAaveStrategy,
        signature: "claimGovernance()",
      },
      {
        // Upgrade OUSD implementation
        contract: cOUSDProxy,
        signature: "upgradeTo(address)",
        args: [cOUSDImpl.address],
      },
      {
        // Set VaultCore implementation
        contract: cVaultProxy,
        signature: "upgradeTo(address)",
        args: [cVaultCoreImpl.address],
      },
      {
        // Set VaultAdmin implementation
        contract: cVault,
        signature: "setAdminImpl(address)",
        args: [cVaultAdminImpl.address],
      },
      {
        // Set new trustee
        contract: cVault,
        signature: "setTrusteeAddress(address)",
        args: [cBuyback.address],
      },
      {
        // Collect old OGN
        contract: cOldBuyback,
        signature: "transferToken(address,uint256)",
        args: [cOGN.address, ognBalance],
      },
      {
        // Move old OGN forward to new contract
        contract: cOGN,
        signature: "transfer(address,uint256)",
        args: [cBuyback.address, ognBalance],
      },
      {
        // Set new oracle address
        contract: cVault,
        signature: "setPriceProvider(address)",
        args: [cOracleRouter.address],
      },
      {
        // Add CRV as a swap token
        contract: cVault,
        signature: "addSwapToken(address)",
        args: [assetAddresses.CRV],
      },
      {
        // Add COMP as a swap token
        contract: cVault,
        signature: "addSwapToken(address)",
        args: [assetAddresses.COMP],
      },
      {
        // Add AAVE as a swap token
        contract: cVault,
        signature: "addSwapToken(address)",
        args: [assetAddresses.AAVE],
      },
      {
        // Approve Compound strategy in Vault
        contract: cVault,
        signature: "approveStrategy(address)",
        args: [cCompoundStrategyProxy.address],
      },
      {
        // Remove the deafult strategy for DAI
        contract: cVault,
        signature: "setAssetDefaultStrategy(address,address)",
        args: [assetAddresses.DAI, addresses.zero],
      },
      {
        // Add Compound as default USDT strategy
        contract: cVault,
        signature: "setAssetDefaultStrategy(address,address)",
        args: [assetAddresses.USDT, cCompoundStrategyProxy.address],
      },
      {
        // Add Compound as default USDC strategy
        contract: cVault,
        signature: "setAssetDefaultStrategy(address,address)",
        args: [assetAddresses.USDC, cCompoundStrategyProxy.address],
      },
      {
        // Approve AAVE strategy in Vault
        contract: cVault,
        signature: "approveStrategy(address)",
        args: [cAaveStrategyProxy.address],
      },
      {
        // Remove old Compound strategy
        contract: cVault,
        signature: "removeStrategy(address)",
        args: ["0xD5433168Ed0B1F7714819646606DB509D9d8EC1f"],
      },
      {
        // Remove old Aave strategy
        contract: cVault,
        signature: "removeStrategy(address)",
        args: ["0x9f2b18751376cF6a3432eb158Ba5F9b1AbD2F7ce"],
      },
      {
        // Remove old Aave strategy
        contract: cVault,
        signature: "removeStrategy(address)",
        args: ["0x3c5fe0a3922777343CBD67D3732FCdc9f2Fa6f2F"],
      },
      {
        // Allocate funds to newly deployed strategies
        contract: cVaultCore,
        signature: "allocate()",
      },
    ],
  };
};

const main = async () => {
  const proposal = await generateProposal();
  const propDescription = proposal.name;
  const propArgs = await proposeArgs(proposal.actions);
  const propOpts = proposal.opts || {};
  if (isMainnet) {
    // On Mainnet, only propose. The enqueue and execution are handled manually via multi-sig.
    log("Sending proposal to governor...");
    await sendProposal(propArgs, propDescription, propOpts);
    log("Proposal sent.");
  } else if (isFork) {
    // On Fork we can send the proposal then impersonate the guardian to execute it.
    log("Sending and executing proposal...");
    await executeProposal(propArgs, propDescription, propOpts);
    log("Proposal executed.");
  } else {
    // Hardcoding gas estimate on Rinkeby since it fails for an undetermined reason...
    const gasLimit = isRinkeby ? 1000000 : null;

    const { governorAddr } = await getNamedAccounts();
    const sGovernor = await ethers.provider.getSigner(governorAddr);

    for (const action of proposal.actions) {
      const { contract, signature, args } = action;

      log(`Sending governance action ${signature} to ${contract.address}`);
      await withConfirmation(
        contract
          .connect(sGovernor)
          [signature](...args, await getTxOpts(gasLimit))
      );
      console.log(`... ${signature} completed`);
    }
  }
};

main();
