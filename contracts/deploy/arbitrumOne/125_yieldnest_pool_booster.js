const addresses = require("../../utils/addresses");
const { deployOnArb } = require("../../utils/deploy-l2");
const { encodeSaltForCreateX } = require("../../utils/deploy");

const createxAbi = require("../../abi/createx.json");
const PoolBoosterBytecode = require("../../artifacts/contracts/strategies/CurvePoolBooster.sol/CurvePoolBooster.json");
const ProxyBytecode = require("../../artifacts/contracts/proxies/Proxies.sol/CurvePoolBoosterProxy.json");

// --------------------------------!!! / WARNING \ !!!-----------------------------------------
//
// `encodedSalt`, ProxyBytecode and PoolBoosterBytecode should be EXACTLY the same as the 125 mainnet !!!
// It is using createX to deploy contract at the SAME address as the one deployed in 125 mainnet.
//
// --------------------------------------------------------------------------------------------

module.exports = deployOnArb(
  {
    deployName: "125_yieldnest_pool_booster",
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

    //const OETH = await ethers.getContractAt(
    //  "OETH",
    //  addresses.mainnet.OETHProxy
    //);

    console.log("\nStarting deployment using CreateX");
    const rewardToken = addresses.mainnet.OETHProxy;
    const votemarket = "0x8c2c5A295450DDFf4CB360cA73FCCC12243D14D9";
    const campaignRemoteManager = "0x53aD4Cd1F1e52DD02aa9FC4A8250A1b74F351CA2";
    //const curvePool = "0xbeb1336c523ca3bd0408f1f8a7aeb0a6305b3157";
    const curveGauge = "0x70e80e0ada57af6a6040132ffb6ca3e5adf87b9f";
    const targetedChainId = 42161; // arbitrum
    const fee = 0;
    const strategist = addresses.multichainStrategist;
    const feeCollector = strategist;
    const governor = addresses.arbitrumOne.admin;

    // Get CreateX contract
    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);

    // Generate salt
    const salt = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.arrayify(rewardToken),
        ethers.utils.arrayify(curveGauge),
        ethers.utils.arrayify(1),
      ])
    );

    const encodedSalt = encodeSaltForCreateX(deployerAddr, false, salt);
    console.log(`Encoded salt: ${encodedSalt}`);

    // --- Deploy implementation --- //
    const cachedInitCodeImpl = ethers.utils.concat([
      PoolBoosterBytecode.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "address", "address"],
        [targetedChainId, rewardToken, curveGauge]
      ),
    ]);
    const txResponse = await withConfirmation(
      cCreateX.connect(sDeployer).deployCreate2(encodedSalt, cachedInitCodeImpl)
    );
    const txReceipt = await txResponse.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is ContractCreation, topics[1] is the address of the deployed contract, topics[2] is the salt
    const poolBoosterImplementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events[1].topics[1].slice(26)}`
    );
    console.log(
      `Curve Booster Implementation deployed at: ${poolBoosterImplementationAddress}`
    );

    // --- Deploy and init proxy --- //
    const cachedInitCodeProxy = ProxyBytecode.bytecode; // No constructor arguments
    const initializeImplem = cCurvePoolBooster.interface.encodeFunctionData(
      "initialize(address,uint16,address,address,address)",
      [strategist, fee, feeCollector, campaignRemoteManager, votemarket]
    );
    const initializeProxy = cCurvePoolBoosterProxy.interface.encodeFunctionData(
      "initialize(address,address,bytes)",
      [
        poolBoosterImplementationAddress, // implementation
        governor, // governor
        initializeImplem, // init data
      ]
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
    const poolBoosterProxyAddress = ethers.utils.getAddress(
      `0x${txReceiptProxy.events[1].topics[1].slice(26)}`
    );
    console.log(`Curve Booster Proxy deployed at: ${poolBoosterProxyAddress}`);

    return {};
  }
);
