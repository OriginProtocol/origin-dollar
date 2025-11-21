const addresses = require("../../utils/addresses");
const { deployOnArb } = require("../../utils/deploy-l2");
const { isFork } = require("../../test/helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { encodeSaltForCreateX } = require("../../utils/deploy");

const createxAbi = require("../../abi/createx.json");

module.exports = deployOnArb(
  {
    deployName: "004_curve_pool_booster_factory",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ withConfirmation }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);
    const cCreateX = await ethers.getContractAt(createxAbi, addresses.createX);
    console.log(`Deployer address: ${deployerAddr}`);

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy CurvePoolBoosterFactory
    // ---
    // ---------------------------------------------------------------------------------------------------------

    // This salt is constructed in a way where CreateX contract will recompute / guard the salt with the deployer address
    // as the message sender matches the initial part of the salt. This ensures that no other address can front-run our
    // factory deployment on another chain.
    const factoryEncodedSalt = encodeSaltForCreateX(
      deployerAddr,
      false,
      ethers.utils.keccak256(1)
    );
    const txResponse = await withConfirmation(
      cCreateX
        .connect(sDeployer)
        .deployCreate2(factoryEncodedSalt, getFactoryBytecode())
    );

    const contractCreationTopic =
      "0xb8fda7e00c6b06a2b54e58521bc5894fee35f1090e5a3bb6390bfe2b98b497f7";
    const txReceipt = await txResponse.wait();
    const implementationAddress = ethers.utils.getAddress(
      `0x${txReceipt.events
        .find((event) => event.topics[0] === contractCreationTopic)
        .topics[1].slice(26)}`
    );
    const cCurvePoolBoosterFactory = await ethers.getContractAt(
      "CurvePoolBoosterFactory",
      implementationAddress
    );

    await cCurvePoolBoosterFactory.initialize(
      addresses.arbitrumOne.admin,
      addresses.multichainStrategist
    );

    console.log(
      `Pool Booster Factory deployed to ${cCurvePoolBoosterFactory.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Deploy CurvePoolBoosterInstance
    // ---
    // ---------------------------------------------------------------------------------------------------------

    // the most important part is the salt, it ensures that the contract is deployed at the same address
    // on the mainnet as well as arbitrum. If the same reward token and gauge require a new pool booster
    // the version should be incremented
    const salt = ethers.utils.keccak256(
      ethers.utils.concat([
        addresses.mainnet.OETHProxy,
        addresses.mainnet.CurveOETHETHplusGauge,
        1,
      ])
    );

    // The way salt is encoded it specifies for CreateX if there should be cross chain protection or not.
    // We don't want chross chain protection, as we want to deploy the pool booster instance on the same address.
    // The factory address is used to guard the salt, so that no other address can front-run our deployment.
    const encodedSalt = encodeSaltForCreateX(
      cCurvePoolBoosterFactory.address,
      false,
      salt
    );

    const poolBoosterPlainAddress =
      await cCurvePoolBoosterFactory.computePoolBoosterAddress(
        addresses.mainnet.OETHProxy,
        addresses.mainnet.CurveOETHETHplusGauge,
        encodedSalt
      );

    console.log(
      `OETH/ETH+ Pool Booster Plain address: ${poolBoosterPlainAddress}`
    );

    if (isFork) {
      console.log("Simulating creation of OETH/ETH+ Pool Booster on fork");
      const sAdmin = await impersonateAndFund(addresses.arbitrumOne.admin);

      await cCurvePoolBoosterFactory
        .connect(sAdmin)
        .createCurvePoolBoosterPlain(
          addresses.mainnet.OETHProxy, // reward token
          addresses.mainnet.CurveOETHETHplusGauge, // gauge
          addresses.multichainStrategist, // fee collector
          0, // fee
          addresses.mainnet.CampaignRemoteManager, // campaign remote manager
          addresses.votemarket, // votemarket
          encodedSalt,
          poolBoosterPlainAddress // expected address
        );
    } else {
      console.log(
        "Call createCurvePoolBoosterPlain on Pool Booster Factory with parameters:"
      );
      console.log("Reward token:", addresses.mainnet.OETHProxy);
      console.log("Gauge:", addresses.mainnet.CurveOETHETHplusGauge);
      console.log("Fee collector:", addresses.multichainStrategist);
      console.log("Fee:", 0);
      console.log(
        "Campaign remote manager:",
        addresses.mainnet.CampaignRemoteManager
      );
      console.log("Votemarket:", addresses.votemarket);
      console.log("Salt:", salt);
      console.log("Expected address:", poolBoosterPlainAddress);
    }
  }
);

async function getFactoryBytecode() {
  // No deployment needed—get factory directly from artifacts
  const factory = await ethers.getContractFactory("CurvePoolBoosterFactory");
  return factory.bytecode;
}
