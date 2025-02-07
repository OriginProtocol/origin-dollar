const { deployOnBase } = require("../../utils/deploy-l2");
const addresses = require("../../utils/addresses");

const ADMIN_ROLE =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = deployOnBase(
  {
    deployName: "011_transfer_governance",
  },
  async ({ ethers }) => {
    const cBridgedWOETHProxy = await ethers.getContract(
      "BridgedBaseWOETHProxy"
    );
    const cBridgedWOETH = await ethers.getContractAt(
      "BridgedWOETH",
      cBridgedWOETHProxy.address
    );

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");
    const cOETHbProxy = await ethers.getContract("OETHBaseProxy");
    const cWOETHbProxy = await ethers.getContract("WOETHBaseProxy");

    const cDripperProxy = await ethers.getContract("OETHBaseDripperProxy");

    const cAMOStrategyProxy = await ethers.getContract(
      "AerodromeAMOStrategyProxy"
    );
    const cWOETHStrategyProxy = await ethers.getContract(
      "BridgedWOETHStrategyProxy"
    );

    return {
      actions: [
        {
          // 1. Grant admin role to Timelock on Bridged wOETH
          // TODO: Revoke role later when everything works fine
          contract: cBridgedWOETH,
          signature: "grantRole(bytes32,address)",
          args: [ADMIN_ROLE, addresses.base.timelock],
        },
        {
          // 2. Bridged wOETH proxy
          contract: cBridgedWOETHProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 3. Vault proxy
          contract: cOETHbVaultProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 4. OETHb proxy
          contract: cOETHbProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 5. WOETHb proxy
          contract: cWOETHbProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 6. Dripper proxy
          contract: cDripperProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 7. AMO Strategy proxy
          contract: cAMOStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
        {
          // 8. Bridged WOETH Strategy Proxy
          contract: cWOETHStrategyProxy,
          signature: "transferGovernance(address)",
          args: [addresses.base.timelock],
        },
      ],
    };
  }
);
