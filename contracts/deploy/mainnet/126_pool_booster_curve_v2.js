const addresses = require("../../utils/addresses");
const {
  deploymentWithGovernanceProposal,
  deployWithConfirmation,
  encodeSaltForCreateX,
} = require("../../utils/deploy");
const createxAbi = require("../../abi/createx.json");
const PoolBoosterFactoryCurveMainnetBytecode = require("../../artifacts/contracts/poolBooster/PoolBoosterFactoryCurveMainnet.sol/PoolBoosterFactoryCurveMainnet.json");

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
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts & Addresses
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    console.log(`\n\nDeployer address: ${deployerAddr}`);

    const cOETH = await ethers.getContractAt(
      "OETH",
      addresses.mainnet.OETHProxy
    );

    // Get CreateX contract
    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterCentralRegistry on Mainnet
    // ---
    // ---------------------------------------------------------------------------------------------------------
    // --- Deploy Proxy
    await deployWithConfirmation("PoolBoostCentralRegistryProxy", []);
    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    // --- Deploy Implementation
    const dPoolBoostCentralRegistry = await deployWithConfirmation(
      "PoolBoostCentralRegistry",
      []
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    // --- Initialize Proxy
    // prettier-ignore
    await withConfirmation(
      cPoolBoostCentralRegistryProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dPoolBoostCentralRegistry.address,
          addresses.mainnet.Timelock,
          "0x"
        )
    );
    console.log(
      "Initialized PoolBoostCentralRegistry proxy and implementation"
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy PoolBoosterFactoryCurveMainnet on Mainnet
    // ---
    // ---------------------------------------------------------------------------------------------------------
    // --- Generate salt
    let salt = ethers.utils.hashMessage("PoolBoosterFactoryCurveMainnet v1");
    let encodedSalt = encodeSaltForCreateX(deployerAddr, false, salt);
    console.log(`Encoded salt: ${encodedSalt}`);

    // --- Generate bytecode
    const poolBoosterFactoryBytecode = ethers.utils.concat([
      PoolBoosterFactoryCurveMainnetBytecode.bytecode,
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address"],
        [
          cOETH.address,
          addresses.mainnet.Timelock,
          cPoolBoostCentralRegistry.address,
        ]
      ),
    ]);

    const txResponse = await withConfirmation(
      cCreateX
        .connect(sDeployer)
        .deployCreate3(encodedSalt, poolBoosterFactoryBytecode)
    );
    const txReceipt = await txResponse.wait();
    // event 0 is GovernorshipTransferred
    // event 1 is Create3ProxyContractCreation
    // event 2 is ContractCreation, topics[0] is the address of the deployed contract
    let implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events[2].topics[0].slice(26)}`
    );
    console.log(
      `PoolBoosterFactoryCurveMainnet deployed at: ${implementationAddress}`
    );

    return {
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "isApprovedFactory(address)",
          args: [implementationAddress],
        },
      ],
    };
  }
);
