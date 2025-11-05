const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { isFork } = require("../../test/helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../../test/_fund");
const { parseUnits } = require("ethers").utils;

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "155_simplify_ousd",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    // Current contracts
    const cVaultProxy = await ethers.getContract("VaultProxy");
    const cVault = await ethers.getContractAt("IVault", cVaultProxy.address);
    const cUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cSSRStrategyProxy = await ethers.getContract("MakerSSRStrategyProxy");

    if (isFork) {
      // Impersonate the strategist
      const strategist = await impersonateAndFund(
        addresses.multichainStrategist
      );

      // Drain the strategies
      await cVault
        .connect(strategist)
        .withdrawAllFromStrategy(cUSDTStrategyProxy.address);
      console.log(
        `Drained Gauntlet Prime USDT Strategy ${cUSDTStrategyProxy.address}`
      );
      await cVault
        .connect(strategist)
        .withdrawAllFromStrategy(cSSRStrategyProxy.address);
      console.log(`Drained SSR Strategy ${cSSRStrategyProxy.address}`);

      // Simulate asset swaps
      const usdt = await ethers.getContractAt("IERC20", addresses.mainnet.USDT);
      const usds = await ethers.getContractAt("IERC20", addresses.mainnet.USDS);
      const usdc = await ethers.getContractAt("IERC20", addresses.mainnet.USDC);

      const usdtBalance = await usdt.balanceOf(cVault.address);
      const usdsBalance = await usds.balanceOf(cVault.address);
      const usdcNeeded = usdtBalance.add(usdsBalance.div(parseUnits("1", 12)));

      console.log(`USDT Balance: ${usdtBalance}`);
      console.log(`USDS Balance: ${usdsBalance}`);
      console.log(`USDC Needed: ${usdcNeeded}`);

      const vaultSigner = await impersonateAndFund(cVault.address);
      await usdt.connect(vaultSigner).transfer(addresses.dead, usdtBalance);
      console.log(`Transferred USDT to dead address ${addresses.dead}`);
      await usds.connect(vaultSigner).transfer(addresses.dead, usdsBalance);
      console.log(`Transferred USDS to dead address ${addresses.dead}`);

      await setERC20TokenBalance(cVault.address, usdc, usdcNeeded);
      console.log(`Funded Vault with ${usdcNeeded} USDC`);
    }

    // Governance Actions
    // ----------------
    return {
      name: `Simplify OUSD
This proposal simplifies OUSD by removing USDT and USDS (and their related strategies) from the Vault. 

The main objective is to make OUSD only be backed by USDC.`,
      actions: [
        // 1. Remove default USDT strategy
        {
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.USDT, addresses.zero],
        },
        // 2. Remove default USDS strategy
        {
          contract: cVault,
          signature: "setAssetDefaultStrategy(address,address)",
          args: [addresses.mainnet.USDS, addresses.zero],
        },
        // 3. Remove Gauntlet Prime USDT Strategy
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cUSDTStrategyProxy.address],
        },
        // 4. Remove SSR Strategy
        {
          contract: cVault,
          signature: "removeStrategy(address)",
          args: [cSSRStrategyProxy.address],
        },
        // 5. Remove USDT
        {
          contract: cVault,
          signature: "removeAsset(address)",
          args: [addresses.mainnet.USDT],
        },
        // 6. Remove USDS
        {
          contract: cVault,
          signature: "removeAsset(address)",
          args: [addresses.mainnet.USDS],
        },
      ],
    };
  }
);
