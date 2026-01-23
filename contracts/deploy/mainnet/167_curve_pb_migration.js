const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const pools = [
  {
    name: "TriOGN-OETH",
    reward: "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3",
    gauge: "0x92d956C1F89a2c71efEEB4Bac45d02016bdD2408",
    pool: "0xB8ac7ce449Ed72FF61dE8043d67B507f9F523Fa2",
    salt: "0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289000000000000000000000004",
    oldPB: "0x7B5e7aDEBC2da89912BffE55c86675CeCE59803E",
    newPB: "0xFc87E0ABe3592945Ad7587F99161dBb340faa767",
  },
  {
    name: "TriOGN-OUSD",
    reward: "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86",
    gauge: "0x92d956C1F89a2c71efEEB4Bac45d02016bdD2408",
    pool: "0xB8ac7ce449Ed72FF61dE8043d67B507f9F523Fa2",
    salt: "0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289000000000000000000000005",
    oldPB: "0x514447A1Ef103f3cF4B0fE92A947F071239f2809",
    newPB: "0x028C6f98C20094367F7b048F0aFA1E11ce0A8DBd",
  },
  {
    name: "OETH/LidoARM",
    reward: "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3",
    gauge: "0xFcaDecfc207e3329a38821E5B04f88029cc4fa62",
    pool: "0x95753095F15870ACC0cB0Ed224478ea61aeb0b8e",
    salt: "0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289000000000000000000000006",
    oldPB: "0xb61e201bd3c864431ec3d3df0ed1ecf38b63cc8b",
    newPB: "0x1A43D2F1bb24aC262D1d7ac05D16823E526FcA32",
  },
  {
    name: "OUSD/frxUSD",
    reward: "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86",
    gauge: "0x928961d0C4F6E8C683bd5695527D060f18d7d60b",
    pool: "0x68d03Ed49800e92D7Aa8aB171424007e55Fd1F49",
    salt: "0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289000000000000000000000007",
    oldPB: "0x02260e04f7851FbF09dd9a4fFd1880568410F77e",
    newPB: "0xc835BcA1378acb32C522f3831b8dba161a763FBE",
  },
];

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "167_curve_pb_migration",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const cCurvePoolBoosterFactory = await ethers.getContractAt(
      "CurvePoolBoosterFactory",
      "0xB6073788e5302122F4DfB6C5aD53a1EAC9cb0289"
    );

    const actions = [];

    for (const pool of pools) {
      const cOldPoolBooster = await ethers.getContractAt(
        "CurvePoolBoosterPlain",
        pool.oldPB
      );

      const cRewardToken = await ethers.getContractAt("OUSD", pool.reward);
      console.log("Reward token address:", cRewardToken.address);

      // Action 1: Create new CurvePoolBoosterPlain
      actions.push({
        contract: cCurvePoolBoosterFactory,
        signature:
          "createCurvePoolBoosterPlain(address,address,address,uint16,address,address,bytes32,address)",
        args: [
          pool.reward,
          pool.gauge,
          addresses.multichainStrategist,
          0,
          addresses.mainnet.CampaignRemoteManager,
          addresses.votemarket,
          pool.salt,
          pool.newPB,
        ],
      });

      // Action 2: Undelegate yield from pool to old pool booster
      actions.push({
        contract: cRewardToken,
        signature: "undelegateYield(address)",
        args: [pool.pool],
      });

      // Action 3: YieldForward to pool to new pool booster
      actions.push({
        contract: cRewardToken,
        signature: "delegateYield(address,address)",
        args: [pool.pool, pool.newPB],
      });

      // Action 4: Rescue tokens from old pool booster to new one
      actions.push({
        contract: cOldPoolBooster,
        signature: "rescueToken(address,address)",
        args: [pool.reward, pool.newPB],
      });
    }

    return {
      name: "Migrate token rewards from CurvePoolBooster to new version",
      actions,
    };
  }
);
