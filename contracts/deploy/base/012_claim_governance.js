const { deployOnBase } = require("../../utils/deploy-l2");

module.exports = deployOnBase(
  {
    deployName: "012_claim_governance",
    useTimelock: true,
  },
  async ({ ethers }) => {
    const cBridgedWOETHProxy = await ethers.getContract(
      "BridgedBaseWOETHProxy"
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
      name: "Claim Governance on superOETHb contracts",
      actions: [
        {
          // 1. Bridged wOETH proxy
          contract: cBridgedWOETHProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 2. Vault proxy
          contract: cOETHbVaultProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 3. OETHb proxy
          contract: cOETHbProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 4. WOETHb proxy
          contract: cWOETHbProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 5. Dripper proxy
          contract: cDripperProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 6. AMO Strategy proxy
          contract: cAMOStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
        {
          // 7. Bridged WOETH Strategy Proxy
          contract: cWOETHStrategyProxy,
          signature: "claimGovernance()",
          args: [],
        },
      ],
    };
  }
);
