const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnSonic(
  {
    deployName: "011_swapx_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    // Deploy Sonic SwapX AMO Strategy proxy
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVaultAdmin = await ethers.getContractAt(
      "OSonicVaultAdmin",
      cOSonicVaultProxy.address
    );
    const cHarvesterProxy = await ethers.getContract("OSonicHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cHarvesterProxy.address
    );
    const dSonicSwapXAMOStrategyProxy = await deployWithConfirmation(
      "SonicSwapXAMOStrategyProxy",
      []
    );
    const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
      "SonicSwapXAMOStrategyProxy"
    );

    console.log(
      `Getting reference to swapXVoter ${addresses.sonic.SwapXVoter}`
    );
    const swapXVoter = await ethers.getContractAt(
      "IVoterV3",
      addresses.sonic.SwapXVoter
    );

    console.log(`About to get gauge for the wS/OS pool`);
    const gaugeAddress = await swapXVoter.gauges(
      addresses.sonic.SwapXWSOS.pool
    );
    console.log(
      `Gauge for the wS/OS pool ${
        addresses.sonic.SwapXWSOS.pool
      } is ${await swapXVoter.gauges(addresses.sonic.SwapXWSOS.pool)}`
    );

    if (gaugeAddress === addresses.zero) {
      console.log(`Getting SwapX owner signer ${addresses.sonic.SwapXOwner}`);
      // Create the wS/OS Gauge
      const swapXOwnerSigner = await impersonateAndFund(
        addresses.sonic.SwapXOwner
      );

      console.log(
        `Creating gauge for the wS/OS pool ${
          addresses.sonic.SwapXWSOS.pool
        } using signer ${await swapXOwnerSigner.getAddress()}`
      );
      const tx = await swapXVoter
        .connect(swapXOwnerSigner)
        .createGauge(addresses.sonic.SwapXWSOS.pool, 0);

      console.log(`Waiting for the createGauge tx ${tx.hash}`);

      const receipt = await tx.wait();
      const createGaugeEvent = receipt.events.find(
        (e) => e.event === "GaugeCreated"
      );

      console.log(`Gauge created: ${createGaugeEvent.args.gauge}`);
      addresses.sonic.SwapXWSOS.gauge = createGaugeEvent.args.gauge;
    } else {
      addresses.sonic.SwapXWSOS.gauge = gaugeAddress;
    }

    // Deploy Sonic SwapX AMO Strategy implementation
    const dSonicSwapXAMOStrategy = await deployWithConfirmation(
      "SonicSwapXAMOStrategy",
      [
        [addresses.sonic.SwapXWSOS.pool, cOSonicVaultProxy.address],
        cOSonicProxy.address,
        addresses.sonic.wS,
        addresses.sonic.SwapXWSOS.gauge,
      ]
    );
    const cSonicSwapXAMOStrategy = await ethers.getContractAt(
      "SonicSwapXAMOStrategy",
      dSonicSwapXAMOStrategyProxy.address
    );
    // Initialize Sonic Curve AMO Strategy implementation
    const initData = cSonicSwapXAMOStrategy.interface.encodeFunctionData(
      "initialize(address[])",
      [[addresses.sonic.SWPx]]
    );
    await withConfirmation(
      // prettier-ignore
      cSonicSwapXAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dSonicSwapXAMOStrategy.address,
          addresses.sonic.timelock,
          initData
        )
    );
    return {
      actions: [
        // 1. Approve new strategy on the Vault
        {
          contract: cOSonicVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 2. Add strategy to mint whitelist
        {
          contract: cOSonicVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 3. Enable for SwapX AMO after it has been deployed
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cSonicSwapXAMOStrategyProxy.address, true],
        },
        // 4. Set the Harvester on the SwapX AMO strategy
        {
          contract: cSonicSwapXAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
