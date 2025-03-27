const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "129_delegate_yield_pool",
    forceDeploy: false,
    //forceSkip: true,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async () => {
    const OUSD = await ethers.getContractAt(
      "OUSD",
      addresses.mainnet.OUSDProxy
    );
    const OETH = await ethers.getContractAt(
      "OETH",
      addresses.mainnet.OETHProxy
    );
    return {
      name: "Delegate Yield for some pool with OUSD and OETH",
      actions: [
        {
          // OUSD/3pool Curve Pool
          contract: OUSD,
          signature: "delegateYield(address,address)",
          args: [
            "0x87650D7bbfC3A9F10587d7778206671719d9910D",
            "0x261Fe804ff1F7909c27106dE7030d5A33E72E1bD",
          ],
        },
        {
          // OUSD/USDT Uniswap Pool
          contract: OUSD,
          signature: "delegateYield(address,address)",
          args: [
            "0x129360c964e2e13910d603043f6287e5e9383374",
            "0xF29c14dD91e3755ddc1BADc92db549007293F67b",
          ],
        },
        {
          // OGN/OETH Uniswap Pool
          contract: OETH,
          signature: "delegateYield(address,address)",
          args: [
            "0x6890cea9bd587c60d23cf08c714c8cbad2269ff3",
            "0x2D3007d07aF522988A0Bf3C57Ee1074fA1B27CF1",
          ],
        },
        {
          // OETH/WETH Uniswap Pool
          contract: OETH,
          signature: "delegateYield(address,address)",
          args: [
            "0x52299416c469843f4e0d54688099966a6c7d720f",
            "0x216dEBBF25e5e67e6f5B2AD59c856Fc364478A6A",
          ],
        },
      ],
    };
  }
);
