const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  encodeSaltForCreateX,
} = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");
const PoolBoosterBytecode = require("../../artifacts/contracts/strategies/CurvePoolBooster.sol/CurvePoolBooster.json");
const ProxyBytecode = require("../../artifacts/contracts/proxies/Proxies.sol/CurvePoolBoosterProxy.json");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "126_pool_booster_curve",
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

    const cCurvePoolBooster = await ethers.getContractAt(
      "CurvePoolBooster",
      addresses.zero
    );
    const cCurvePoolBoosterProxy = await ethers.getContractAt(
      "CurvePoolBoosterProxy",
      addresses.zero
    );

    const OUSD = await ethers.getContractAt(
      "OUSD",
      addresses.mainnet.OUSDProxy
    );

    const OETH = await ethers.getContractAt(
      "OETH",
      addresses.mainnet.OETHProxy
    );

    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);

    // ------------------------------------------------------------------------------------------------------------------------------------
    // ---
    // --- OETH Pool Booster
    // ---
    // ------------------------------------------------------------------------------------------------------------------------------------
    console.log("\nStarting deployment using CreateX: OETH");
    let rewardToken = addresses.mainnet.OETHProxy;
    let gauge = addresses.mainnet.CurveTriOGNGauge;
    let targetedChainId = 42161; // arbitrum
    const fee = 0;

    // Generate salt
    let salt = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.arrayify(rewardToken),
        ethers.utils.arrayify(gauge),
        ethers.utils.arrayify(1),
      ])
    );

    let encodedSalt = encodeSaltForCreateX(deployerAddr, false, salt);
    console.log(`Encoded salt for OETH: ${encodedSalt}`);

    // --- Deploy implementation --- //
    let cachedInitCodeImpl = ethers.utils.concat([
      PoolBoosterBytecode.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address"],
        [targetedChainId, rewardToken, gauge]
      ),
    ]);
    let txResponse = await withConfirmation(
      cCreateX.connect(sDeployer).deployCreate2(encodedSalt, cachedInitCodeImpl)
    );
    let txReceipt = await txResponse.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    let implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events[1].topics[1].slice(26)}`
    );
    console.log(
      `Curve Booster Implementation OETH deployed at: ${implementationAddress}`
    );

    // --- Deploy and init proxy --- //
    let cachedInitCodeProxy = ProxyBytecode.bytecode; // No constructor arguments
    let initializeImplem = cCurvePoolBooster.interface.encodeFunctionData(
      "initialize(address,uint16,address,address,address)",
      [
        addresses.multichainStrategist, // strategist
        fee, // fee
        addresses.multichainStrategist, // feeCollector
        addresses.mainnet.CampaignRemoteManager, // campaignRemoteManager
        addresses.votemarket, // votemarket
      ]
    );
    let initializeProxy = cCurvePoolBoosterProxy.interface.encodeFunctionData(
      "initialize(address,address,bytes)",
      [
        implementationAddress, // implementation
        addresses.mainnet.Timelock, // governor
        initializeImplem, // init data
      ]
    );
    let txResponseProxy = await withConfirmation(
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
    let txReceiptProxy = await txResponseProxy.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    // event 2 is StrategistUpdated
    // event 3 is FeeUpdated
    // event 4 is FeeCollectorUpdated
    // event 5 is CampaignRemoteManagerUpdated
    // event 6 is GovernorshipTransferred
    const pbOETHProxyAddress = ethers.utils.getAddress(
      `0x${txReceiptProxy.events[1].topics[1].slice(26)}`
    );
    console.log(`Curve Booster Proxy OETH deployed at: ${pbOETHProxyAddress}`);

    // ------------------------------------------------------------------------------------------------------------------------------------
    // ---
    // --- OUSD Pool Booster
    // ---
    // ------------------------------------------------------------------------------------------------------------------------------------
    console.log("\nStarting deployment using CreateX: OUSD");
    rewardToken = addresses.mainnet.OUSDProxy;
    gauge = addresses.mainnet.CurveTriOGNGauge;
    targetedChainId = 42161; // arbitrum

    // Generate salt
    salt = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.arrayify(rewardToken),
        ethers.utils.arrayify(gauge),
        ethers.utils.arrayify(1),
      ])
    );

    encodedSalt = encodeSaltForCreateX(deployerAddr, false, salt);
    console.log(`Encoded salt for OUSD: ${encodedSalt}`);

    // --- Deploy implementation --- //
    cachedInitCodeImpl = ethers.utils.concat([
      PoolBoosterBytecode.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address"],
        [targetedChainId, rewardToken, gauge]
      ),
    ]);
    txResponse = await withConfirmation(
      cCreateX.connect(sDeployer).deployCreate2(encodedSalt, cachedInitCodeImpl)
    );
    txReceipt = await txResponse.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events[1].topics[1].slice(26)}`
    );
    console.log(
      `Curve Booster Implementation OUSD deployed at: ${implementationAddress}`
    );

    // --- Deploy and init proxy --- //
    cachedInitCodeProxy = ProxyBytecode.bytecode; // No constructor arguments
    initializeImplem = cCurvePoolBooster.interface.encodeFunctionData(
      "initialize(address,uint16,address,address,address)",
      [
        addresses.multichainStrategist, // strategist
        fee, // fee
        addresses.multichainStrategist, // feeCollector
        addresses.mainnet.CampaignRemoteManager, // campaignRemoteManager
        addresses.votemarket, // votemarket
      ]
    );
    initializeProxy = cCurvePoolBoosterProxy.interface.encodeFunctionData(
      "initialize(address,address,bytes)",
      [
        implementationAddress, // implementation
        addresses.mainnet.Timelock, // governor
        initializeImplem, // init data
      ]
    );
    txResponseProxy = await withConfirmation(
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
    txReceiptProxy = await txResponseProxy.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    // event 2 is StrategistUpdated
    // event 3 is FeeUpdated
    // event 4 is FeeCollectorUpdated
    // event 5 is CampaignRemoteManagerUpdated
    // event 6 is GovernorshipTransferred
    const pbOUSDProxyAddress = ethers.utils.getAddress(
      `0x${txReceiptProxy.events[1].topics[1].slice(26)}`
    );
    console.log(`Curve Booster Proxy OUSD deployed at: ${pbOUSDProxyAddress}`);

    return {
      name: "Yield Forward from TriOGN Curve Pool -> Pool Boosters",
      actions: [
        {
          contract: OETH,
          signature: "delegateYield(address,address)",
          args: [addresses.mainnet.CurveTriOGNPool, pbOETHProxyAddress],
        },
        {
          contract: OUSD,
          signature: "delegateYield(address,address)",
          args: [addresses.mainnet.CurveTriOGNPool, pbOUSDProxyAddress],
        },
      ],
    };
  }
);
