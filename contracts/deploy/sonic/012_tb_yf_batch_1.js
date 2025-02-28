const { deployOnSonic } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy.js");
const { oethUnits } = require("../../test/helpers");

module.exports = deployOnSonic(
  {
    deployName: "012_tb_yf_batch_1",
  },
  async ({ ethers }) => {
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

    const SALT = ethers.BigNumber.from("1740758400"); // epoch as Friday 28th Feb 2025 4PM UTC

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBoosterFactory SwapxSingle Deployment
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const dPoolBoosterSwapxSingleFactory = await deployWithConfirmation(
      "PoolBoosterFactorySwapxSingle_v1",
      [
        addresses.sonic.OSonicProxy,
        addresses.sonic.timelock,
        cPoolBoostCentralRegistryProxy.address,
      ],
      "PoolBoosterFactorySwapxSingle"
    );
    const cPoolBoosterFactorySwapxSingle = await ethers.getContract(
      "PoolBoosterFactorySwapxSingle_v1"
    );
    console.log(
      `Pool Booster Swapx Single deployed to ${dPoolBoosterSwapxSingleFactory.address}`
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxSingle
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const poolBoosterSingleCreationArgs = {};
    const poolBoosterSingleComputedAddresses = {};
    const poolsSingle = ["Equalizer.WsOs", "Equalizer.ThcOs", "SwapX.OsFiery"];

    const getAddress = (path) =>
      path.split(".").reduce((obj, key) => obj?.[key], addresses.sonic);

    await Promise.all(
      poolsSingle.map(async (pool) => {
        const current = getAddress(pool);
        if (!current?.extBribeOS || !current?.pool) return;

        poolBoosterSingleCreationArgs[pool] = [
          current.extBribeOS,
          current.pool,
          SALT,
        ];
        poolBoosterSingleComputedAddresses[pool] =
          await cPoolBoosterFactorySwapxSingle.computePoolBoosterAddress(
            ...poolBoosterSingleCreationArgs[pool]
          );
      })
    );

    const yieldforwardAndPoolBoosterSwapXSingleActions = poolsSingle.flatMap(
      (pool) => {
        const current = getAddress(pool);
        if (!current?.pool || !poolBoosterSingleComputedAddresses[pool])
          return [];

        return [
          {
            contract: cPoolBoosterFactorySwapxSingle,
            signature: "createPoolBoosterSwapxSingle(address,address,uint256)",
            args: poolBoosterSingleCreationArgs[pool],
          },
          {
            contract: cOSonic,
            signature: "delegateYield(address,address)",
            args: [current.pool, poolBoosterSingleComputedAddresses[pool]],
          },
        ];
      }
    );

    // ---------------------------------------------------------------------------------------------------------
    // ---
    // --- PoolBooster SwapxDouble
    // ---
    // ---------------------------------------------------------------------------------------------------------
    const SPLIT = oethUnits("0.7");
    const poolBoosterDoubleCreationArgs = {};
    const poolBoosterDoubleComputedAddresses = {};

    const poolsDouble = ["OsSfrxUSD", "OsScUSD", "OsSilo"];

    await Promise.all(
      poolsDouble.map(async (pool) => {
        poolBoosterDoubleCreationArgs[pool] = [
          addresses.sonic.SwapX[pool].extBribeOS,
          addresses.sonic.SwapX[pool].extBribeOther,
          addresses.sonic.SwapX[pool].pool,
          SPLIT,
          SALT,
        ];

        poolBoosterDoubleComputedAddresses[pool] =
          await cPoolBoosterFactorySwapxDouble.computePoolBoosterAddress(
            ...poolBoosterDoubleCreationArgs[pool]
          );

        console.log(
          `PoolBooster for ${pool} will be created at ${poolBoosterDoubleComputedAddresses[pool]}`
        );
      })
    );

    const yieldforwardAndPoolBoosterSwapXDoubleActions = poolsDouble.flatMap(
      (pool) => [
        {
          contract: cPoolBoosterFactorySwapxDouble,
          signature:
            "createPoolBoosterSwapxDouble(address,address,address,uint256,uint256)",
          args: poolBoosterDoubleCreationArgs[pool],
        },
        {
          contract: cOSonic,
          signature: "delegateYield(address,address)",
          args: [
            addresses.sonic.SwapX[pool].pool,
            poolBoosterDoubleComputedAddresses[pool],
          ],
        },
      ]
    );

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
        ...yieldforwardAndPoolBoosterSwapXSingleActions,
        ...yieldforwardAndPoolBoosterSwapXDoubleActions,
      ],
    };
  }
);

/*



*/
