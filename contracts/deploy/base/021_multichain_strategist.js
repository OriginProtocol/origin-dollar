const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

const EXECUTOR_ROLE =
  "0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63";

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "021_multichain_strategist",
  },
  async ({ ethers }) => {
    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbVault = await ethers.getContractAt(
      "IVault",
      cOETHbVaultProxy.address
    );

    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cAMOStrategy = await ethers.getContractAt(
      "AerodromeAMOStrategy",
      cAMOStrategyProxy.address
    );

    const cBridgedWOETHStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );
    const cBridgedWOETHStrategy = await ethers.getContractAt(
      "BridgedWOETHStrategy",
      cBridgedWOETHStrategyProxy.address
    );

    const cTimelock = await ethers.getContractAt(
      "ITimelockController",
      addresses.base.timelock
    );

    return {
      name: "Switch to Multichain Strategist",
      actions: [
        {
          contract: cOETHbVault,
          signature: "setStrategistAddr(address)",
          args: [addresses.base.multichainStrategist],
        },
        {
          contract: cOETHbVault,
          signature: "setTrusteeAddress(address)",
          args: [addresses.base.multichainStrategist],
        },
        {
          contract: cAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.base.multichainStrategist],
        },
        {
          contract: cBridgedWOETHStrategy,
          signature: "setHarvesterAddress(address)",
          args: [addresses.base.multichainStrategist],
        },
        {
          contract: cTimelock,
          signature: "grantRole(bytes32,address)",
          args: [EXECUTOR_ROLE, addresses.base.multichainStrategist],
        },
        {
          contract: cTimelock,
          signature: "revokeRole(bytes32,address)",
          args: [EXECUTOR_ROLE, addresses.base.strategist],
        },
      ],
    };
  }
);
