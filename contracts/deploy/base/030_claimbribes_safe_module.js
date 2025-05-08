const { deployOnBase } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");

const addresses = require("../../utils/addresses");
const { isFork } = require("../../utils/hardhat-helpers");
const { impersonateAndFund } = require("../../utils/signers");

module.exports = deployOnBase(
  {
    deployName: "030_claimbribes_safe_module",
  },
  async ({ ethers }) => {
    const safeAddress = "0xb6D85Ce798660076152d6FD3a484129668839c95";
    const voter = "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5";
    const veAero = "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4";
    const usdcAddr = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

    await deployWithConfirmation("ClaimBribesSafeModule", [
      safeAddress,
      voter,
      veAero,
    ]);
    const cClaimBribesSafeModule = await ethers.getContract(
      "ClaimBribesSafeModule"
    );

    if (isFork) {
      const OETHb = await ethers.getContract("OETHBaseProxy");
      const safeSigner = await impersonateAndFund(safeAddress);

      const cSafe = await ethers.getContractAt(
        ["function enableModule(address module) external"],
        safeAddress
      );

      await withConfirmation(
        cSafe.connect(safeSigner).enableModule(cClaimBribesSafeModule.address)
      );
      console.log("Enabled module");

      // await withConfirmation(
      //     cClaimBribesSafeModule.connect(cSafe).grantRole(
      //         ethers.utils.keccak256("EXECUTOR_ROLE"),
      //         safeAddress
      //     )
      // );

      // OETHb/WETH
      await withConfirmation(
        cClaimBribesSafeModule
          .connect(safeSigner)
          .addBribePool(addresses.base.aerodromeOETHbWETHClPool)
      );
      // WETH/USDC
      await withConfirmation(
        cClaimBribesSafeModule
          .connect(safeSigner)
          .addBribePool("0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59")
      );
      console.log("Added bribe pools");

      const nftIdsToTest = [
        72538, 72539, 72540, 72541, 72542, 72543, 72544, 72545, 72546, 72547,
        72548, 72549, 72550, 72551, 72552, 72553, 72554, 72555, 72556, 72557,
        72558, 72559, 72560, 72561, 72562, 72563, 72564, 72565, 72566, 72567,
        72568, 72569, 72570, 72571, 72572, 72573, 72574, 72575, 72576, 72577,
        72578, 72579, 72580, 72581, 72582, 72583, 72584, 72585, 72586, 72587,
      ];

      await withConfirmation(
        cClaimBribesSafeModule.connect(safeSigner).addNFTIds(nftIdsToTest)
      );
      console.log("Added NFTs");

      const weth = await ethers.getContractAt("IERC20", addresses.base.WETH);
      const aero = await ethers.getContractAt("IERC20", addresses.base.AERO);
      const oethb = await ethers.getContractAt("IERC20", OETHb.address);
      const usdc = await ethers.getContractAt("IERC20", usdcAddr);
      const wethBalanceBefore = await weth.balanceOf(safeAddress);
      const aeroBalanceBefore = await aero.balanceOf(safeAddress);
      const oethbBalanceBefore = await oethb.balanceOf(safeAddress);
      const usdcBalanceBefore = await usdc.balanceOf(safeAddress);

      for (let i = 0; i < Math.ceil(nftIdsToTest.length / 9); i += 9) {
        console.log(i, i + 9);
        await withConfirmation(
          cClaimBribesSafeModule.connect(safeSigner).claimBribes(i, i + 9)
        );
      }
      console.log("Claimed bribes");

      const wethBalanceAfter = await weth.balanceOf(safeAddress);
      const aeroBalanceAfter = await aero.balanceOf(safeAddress);
      const oethbBalanceAfter = await oethb.balanceOf(safeAddress);
      const usdcBalanceAfter = await usdc.balanceOf(safeAddress);
      console.log(
        "WETH balance",
        wethBalanceBefore.toString(),
        wethBalanceAfter.toString()
      );
      console.log(
        "AERO balance",
        aeroBalanceBefore.toString(),
        aeroBalanceAfter.toString()
      );
      console.log(
        "OETHb balance",
        oethbBalanceBefore.toString(),
        oethbBalanceAfter.toString()
      );
      console.log(
        "USDC balance",
        usdcBalanceBefore.toString(),
        usdcBalanceAfter.toString()
      );
    }

    return {};
  }
);
