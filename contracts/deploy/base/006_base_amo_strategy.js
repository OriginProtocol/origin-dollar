const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { oethUnits } = require("../../test/helpers");
const {
  deployBaseAerodromeAMOStrategyImplementation,
} = require("../deployActions");

//const aeroVoterAbi = require("../../test/abi/aerodromeVoter.json");
//const slipstreamPoolAbi = require("../../test/abi/aerodromeSlipstreamPool.json")
//const { impersonateAndFund } = require("../../utils/signers.js");

/**
 * This is needed only as long as the gauge isn't created on the base mainnet
 */
// const setupAerodromeOEthbWETHGauge = async (oethbAddress) => {
//   const voter = await ethers.getContractAt(aeroVoterAbi, addresses.base.aeroVoterAddress);
//   const amoPool = await ethers.getContractAt(slipstreamPoolAbi, addresses.base.aerodromeOETHbWETHClPool);

//   const aeroGaugeSigner = await impersonateAndFund(addresses.base.aeroGaugeGovernorAddress);

//   // whitelist OETHb
//   await voter
//     .connect(aeroGaugeSigner)
//     .whitelistToken(
//       oethbAddress,
//       true
//     );

//   // create a gauge
//   await voter
//     .connect(aeroGaugeSigner)
//     .createGauge(
//       // 0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A
//       addresses.base.slipstreamPoolFactory,
//       // 0x6446021F4E396dA3df4235C62537431372195D38
//       addresses.base.aerodromeOETHbWETHClPool
//     );

//   return await amoPool.gauge();
// };

module.exports = deployOnBase(
  {
    deployName: "006_base_amo_strategy",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    const cAMOStrategyImpl =
      await deployBaseAerodromeAMOStrategyImplementation();
    await deployWithConfirmation("AerodromeAMOStrategyProxy");
    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAMOStrategyProxy.address
    );

    console.log("Deployed AMO strategy and proxy contracts");

    // Init the AMO strategy
    const initData = cAMOStrategyImpl.interface.encodeFunctionData(
      "initialize(address[])",
      [
        [addresses.base.AERO], // rewardTokenAddresses
      ]
    );
    // prettier-ignore
    await withConfirmation(
      cAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cAMOStrategyImpl.address,
          deployerAddr,
          initData
        )
    );
    console.log("Initialized cAMOStrategyProxy and implementation");

    await withConfirmation(
      cAMOStrategy.connect(sDeployer).setAllowedPoolWethShareInterval(
        oethUnits("0.18"), // 18%
        oethUnits("0.22") // 22%
      )
    );

    await withConfirmation(
      cAMOStrategy.connect(sDeployer).safeApproveAllTokens()
    );

    console.log("AMOStrategy configured");

    // Transfer ownership
    await withConfirmation(
      cAMOStrategyProxy.connect(sDeployer).transferGovernance(governorAddr)
    );
    console.log("Transferred Governance");

    return {
      actions: [
        {
          // 1. Claim Governance on the AMO strategy
          contract: cAMOStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 2. Approve the AMO strategy on the Vault
          contract: cOETHbVault,
          signature: "approveStrategy(address)",
          args: [cAMOStrategyProxy.address],
        },
        {
          // 3. Set strategist address
          contract: cOETHbVault,
          signature: "setStrategistAddr(address)",
          args: [addresses.base.strategist],
        },
        {
          // 4. Set strategy as whitelisted one to mint OETHb tokens
          contract: cOETHbVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cAMOStrategyProxy.address],
        },
        {
          // 5. Set harvester address
          contract: cAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.base.strategist],
        },
      ],
    };
  }
);
