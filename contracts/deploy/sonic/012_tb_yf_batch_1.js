const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const {
  deployWithConfirmation,
  createPoolBoosterSonic,
} = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "012_tb_yf_batch_1",
  },
  async ({ ethers }) => {
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Contracts
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const cOSonic = await ethers.getContractAt(
      "OSonic",
      addresses.sonic.OSonicProxy
    );

    const cPoolBoostCentralRegistryProxy = await ethers.getContract(
      "PoolBoostCentralRegistryProxy"
    );

    const cPoolBoostCentralRegistry = await ethers.getContractAt(
      "PoolBoostCentralRegistry",
      cPoolBoostCentralRegistryProxy.address
    );

    const cPoolBoosterFactorySwapxDouble = await ethers.getContract(
      "PoolBoosterFactorySwapxDouble_v1"
    );

    const SALT = ethers.BigNumber.from("1741009056"); // epoch as Friday 28th Feb 2025 4PM UTC

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBoosterFactory SwapxSingle Deployment
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterSwapxSingleFactory = await deployWithConfirmation(
      "PoolBoosterFactorySwapxSingle",
      [
        addresses.sonic.OSonicProxy,
        addresses.sonic.timelock,
        cPoolBoostCentralRegistryProxy.address,
      ]
    );
    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle"
    );
    console.log(
      `Pool Booster Swapx Single deployed to ${dPoolBoosterSwapxSingleFactory.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsSingle } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxSingle,
      pools: ["Equalizer.WsOs", "Equalizer.ThcOs", "SwapX.OsFiery"],
      salt: SALT,
      type: "Single",
    });
    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxDouble
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const { actions: actionsDouble } = await createPoolBoosterSonic({
      cOSonic,
      factoryContract: cPoolBoosterFactorySwapxDouble,
      pools: ["SwapX.OsSfrxUSD", "SwapX.OsScUSD", "SwapX.OsSilo"],
      salt: SALT,
      split: oethUnits("0.7"),
      type: "Double",
    });

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- Governance Actions
    // ---
    // ---------------------------------------------------------------------------------------------------------
    return {
      actions: [
        {
          // set the factory as an approved one
          contract: cPoolBoostCentralRegistry,
          signature: "approveFactory(address)",
          args: [dPoolBoosterSwapxSingleFactory.address],
        },
        {
          // Plateform: SwapX
          // Protocol: Moon Bay
          // From: VolatileV1 AMM - MOON/OS --> To: EOA
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x51caf8b6d184e46aeb606472258242aacee3e23b",
            "0xa9d3b1408353d05064d47daf0dc98e104eb9c98a",
          ],
        },
        {
          // Plateform: SwapX
          // Protocol: BOL
          // From: VolatileV1 AMM - BOL/OS --> To: EOA
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x0666b11a59f02781854e778687ce312d6b306ce4",
            "0x3ef000Bae3e8105be55F76FDa784fD7d69CFf30e",
          ],
        },
        {
          // Plateform: SwapX
          // Protocol: EGGS
          // From: VolatileV1 AMM - OS/EGGS --> To: EOA
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x6feae13b486a225fb2247ccfda40bf8f1dd9d4b1",
            "0x98Fc4CE3dFf1d0D7c9dF94f7d9b4E6E6468D5EfF",
          ],
        },
        {
          // Plateform: Metropolis
          // Protocol: Paintswap
          // From: BRUSH/OS --> To: EOA
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0xbb9e9f35e5eda1eeed3d811366501d940866268f",
            "0x3b99636439FBA6314C0F52D35FEd2fF442191407",
          ],
        },
        {
          // Protocol: HOG
          // From: HogGenesisRewardPool --> To: Safe Contract
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            "0x2e585b96a2ef1661508110e41c005be86b63fc34",
            "0xF0E3E07e11bFA26AEB0C0693824Eb0BF1653AE77",
          ],
        },
        ...actionsSingle,
        ...actionsDouble,
      ],
    };
  }
);
