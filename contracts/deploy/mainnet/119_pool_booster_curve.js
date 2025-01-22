const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");
const PoolBoosterBytecode = require("../../artifacts/contracts/strategies/CurvePoolBooster.sol/CurvePoolBooster.json");
const ProxyBytecode = require("../../artifacts/contracts/proxies/Proxies.sol/CurvePoolBoosterProxy.json");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "119_pool_booster_curve",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    console.log(`Deployer address: ${deployerAddr}`);

    console.log("\nStarting deployment using CreateX");
    const rewardToken = addresses.mainnet.OUSDProxy;
    const gauge = addresses.mainnet.CurveOUSDUSDTGauge;
    const targetedChainId = 42161; // arbitrum
    const fee = 0;

    // Get CreateX contract
    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);

    // Generate encoded salt (deployer address || crossChainProtectionFlag || bytes11(keccak256(rewardToken, gauge)))
    const addressDeployerBytes20 = ethers.utils.hexlify(
      ethers.utils.zeroPad(deployerAddr, 20)
    );
    const crossChainProtectioFlagBytes1 = ethers.utils.hexlify(
      ethers.utils.zeroPad(0, 1)
    );
    const saltBytes11 =
      "0x" +
      ethers.utils
        .keccak256(
          ethers.utils.concat([
            ethers.utils.arrayify(rewardToken),
            ethers.utils.arrayify(gauge),
          ])
        )
        .slice(2, 24);
    const encodedSalt = ethers.utils.hexlify(
      ethers.utils.concat([
        addressDeployerBytes20,
        crossChainProtectioFlagBytes1,
        saltBytes11,
      ])
    );
    console.log(`Encoded salt: ${encodedSalt}`);

    // --- Deploy implementation --- //
    const cachedInitCodeImpl = ethers.utils.concat([
      PoolBoosterBytecode.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address"],
        [targetedChainId, rewardToken, gauge]
      ),
    ]);
    const txResponse = await withConfirmation(
      cCreateX.connect(sDeployer).deployCreate2(encodedSalt, cachedInitCodeImpl)
    );
    const txReceipt = await txResponse.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    const implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events[1].topics[1].slice(26)}`
    );
    console.log(
      `Curve Booster Implementation deployed at: ${implementationAddress}`
    );

    // --- Deploy and init proxy --- //
    const cachedInitCodeProxy = ProxyBytecode.bytecode; // No constructor arguments
    const initializeImplem = ethers.utils.hexlify(
      ethers.utils.concat([
        "0x67abbc82",
        ethers.utils.defaultAbiCoder.encode(
          ["address", "uint16", "address", "address"],
          [
            addresses.base.multichainStrategist, // strategist
            fee, // fee
            addresses.base.multichainStrategist, // feeCollector
            addresses.mainnet.CampaignRemoteManager, // campaignRemoteManager
          ]
        ),
      ])
    );
    const initializeProxy = ethers.utils.hexlify(
      ethers.utils.concat([
        "0xcf7a1d77",
        ethers.utils.defaultAbiCoder.encode(
          ["address", "address", "bytes"],
          [implementationAddress, addresses.mainnet.Timelock, initializeImplem] // implementation, governor, init data
        ),
      ])
    );
    const txResponseProxy = await withConfirmation(
      cCreateX
        .connect(sDeployer)
        .deployCreate2AndInit(
          encodedSalt,
          cachedInitCodeProxy,
          initializeProxy,
          ["0x00", "0x00"],
          deployerAddr
        )
    );
    const txReceiptProxy = await txResponseProxy.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    // event 2 is StrategistUpdated
    // event 3 is FeeUpdated
    // event 4 is FeeCollectorUpdated
    // event 5 is CampaignRemoteManagerUpdated
    // event 6 is GovernorshipTransferred
    const proxyAddress = ethers.utils.getAddress(
      `0x${txReceiptProxy.events[1].topics[1].slice(26)}`
    );
    console.log(`Curve Booster Proxy deployed at: ${proxyAddress}`);
    return {};
  }
);
