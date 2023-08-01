const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const {
  defaultFixture,
  oethCollateralSwapFixtureSetup,
  oeth1InchSwapperFixtureSetup,
  impersonateAndFundContract,
} = require("../_fixture");
const {
  SWAP_SELECTOR,
  UNISWAP_SELECTOR,
  UNISWAPV3_SELECTOR,
} = require("../../utils/1Inch");

const runFixture = oethCollateralSwapFixtureSetup();
const run1InchFixture = oeth1InchSwapperFixtureSetup();

const log = require("../../utils/logger")("test:oeth:swapper");

describe("OETH Vault - Swapper", () => {
  after(async () => {
    await defaultFixture();
  });

  describe("Swap Collateral", () => {
    let fixture;

    beforeEach(async () => {
      fixture = await runFixture();
    });

    it("Should allow Governor to set slippage for assets", async () => {
      const { governor, oethVault, weth } = fixture;

      const tx = oethVault
        .connect(governor)
        .setOracleSlippage(weth.address, 123);
      await expect(tx)
        .to.emit(oethVault, "SwapSlippageChanged")
        .withArgs(weth.address, 123);
    });

    it("Should not allow Governor to set slippage for unsupported assets", async () => {
      const { governor, oethVault, dai } = fixture;

      const tx = oethVault
        .connect(governor)
        .setOracleSlippage(dai.address, 123);
      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("Should not allow anyone else to set slippage for assets", async () => {
      const { strategist, josh, oethVault, weth } = fixture;

      for (const user of [strategist, josh]) {
        const tx = oethVault.connect(user).setOracleSlippage(weth.address, 123);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should not allow Governor to set slippage above 10%", async () => {
      const { governor, oethVault, weth } = fixture;

      const tx = oethVault
        .connect(governor)
        .setOracleSlippage(weth.address, 1100);
      await expect(tx).to.be.revertedWith("Slippage too high");
    });

    it("Should allow to change Swapper address", async () => {
      const { governor, oethVault, weth } = fixture;

      // Pretend WETH is swapper address
      const tx = oethVault.connect(governor).setSwapper(weth.address);

      await expect(tx)
        .to.emit(oethVault, "SwapperChanged")
        .withArgs(weth.address);

      expect(await oethVault.swapper()).to.equal(weth.address);
    });

    it("Should not allow anyone else to set swapper address", async () => {
      const { strategist, josh, oethVault, weth } = fixture;

      for (const user of [strategist, josh]) {
        const tx = oethVault.connect(user).setSwapper(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow the governor to change allowed swap undervalue", async () => {
      const { governor, oethVault } = fixture;

      const tx = oethVault.connect(governor).setSwapAllowedUndervalue(10);

      await expect(tx)
        .to.emit(oethVault, "SwapAllowedUndervalueChanged")
        .withArgs(10);

      expect(await oethVault.allowedSwapUndervalue()).to.equal(10);
    });

    it("Should not allow anyone else to set allowed swap undervalue", async () => {
      const { strategist, josh, oethVault } = fixture;

      for (const user of [strategist, josh]) {
        const tx = oethVault.connect(user).setSwapAllowedUndervalue(10);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow the governor to set allowed swap undervalue to 100%", async () => {
      const { governor, oethVault } = fixture;

      const hundredPercent = 10000;
      const tx = oethVault
        .connect(governor)
        .setSwapAllowedUndervalue(hundredPercent);

      await expect(tx)
        .to.emit(oethVault, "SwapAllowedUndervalueChanged")
        .withArgs(hundredPercent);

      expect(await oethVault.allowedSwapUndervalue()).to.equal(hundredPercent);
    });

    it("Should not allow setting undervalue percentage over 100%", async () => {
      const { governor, oethVault } = fixture;

      const tx = oethVault.connect(governor).setSwapAllowedUndervalue(10001);

      await expect(tx).to.be.revertedWith("Invalid basis points");
    });

    it("Should allow to swap tokens", async () => {
      const { weth, reth, stETH, frxETH, oethVault, strategist } = fixture;

      const fromAmount = utils.parseEther("20");

      for (const fromAsset of [weth, reth, stETH, frxETH]) {
        const toAsset = fromAsset.address === weth.address ? stETH : weth;
        const toAmount = utils.parseEther("24");
        log(
          `swapping 20 ${await fromAsset.symbol()} to ${await toAsset.symbol()}`
        );

        // Call swap method
        const tx = await oethVault
          .connect(strategist)
          .swapCollateral(
            fromAsset.address,
            toAsset.address,
            fromAmount,
            toAmount,
            []
          );

        expect(tx)
          .to.emit(oethVault, "Swapped")
          .withArgs(fromAsset.address, toAsset.address, fromAmount, toAmount);
      }
    });

    it("Should revert swap if received less tokens than strategist desired", async () => {
      const { weth, stETH, oethVault, strategist, mockSwapper } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("18"));

      const fromAmount = utils.parseEther("20");
      const toAmount = utils.parseEther("20");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Strategist slippage limit");
    });

    it("Should revert swap if received less tokens than Oracle slippage", async () => {
      const { weth, stETH, oethVault, strategist } = fixture;

      const fromAmount = utils.parseEther("20");
      const toAmount = utils.parseEther("16");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Oracle slippage limit exceeded");
    });

    it("Should revert swap if value is under supply", async () => {
      const {
        weth,
        stETH,
        oeth,
        oethVault,
        governor,
        strategist,
        mockSwapper,
      } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("180"));
      // increase the allowed Oracle slippage per asset to 9.99%
      await oethVault.connect(governor).setOracleSlippage(weth.address, 999);
      await oethVault.connect(governor).setOracleSlippage(stETH.address, 999);

      const fromAmount = utils.parseEther("200");
      const toAmount = utils.parseEther("170");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await oethVault.totalValue()}`);

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Allowed value < supply");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await oethVault.totalValue()}`);
    });
    it("Should allow swap if value is under supply by less than the allowed percentage", async () => {
      const {
        weth,
        stETH,
        oeth,
        oethVault,
        governor,
        strategist,
        mockSwapper,
      } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("19"));
      // increase the allowed Oracle slippage per asset to 9.99%
      await oethVault.connect(governor).setOracleSlippage(weth.address, 999);
      await oethVault.connect(governor).setOracleSlippage(stETH.address, 999);

      const fromAmount = utils.parseEther("20");
      const toAmount = utils.parseEther("17");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await oethVault.totalValue()}`);

      // Call swap method
      const tx = await oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.emit(oethVault, "Swapped");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await oethVault.totalValue()}`);
    });

    it("Should revert if fromAsset is not supported", async () => {
      const { weth, dai, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(dai.address, weth.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("From asset is not supported");
    });

    it("Should revert if toAsset is not supported", async () => {
      const { weth, dai, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, dai.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("To asset is not supported");
    });

    it("Should swap if capital is paused", async () => {
      const { weth, stETH, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Fund Vault with some assets
      const vaultSigner = await impersonateAndFundContract(oethVault.address);
      await weth.connect(vaultSigner).mint(fromAmount);

      await oethVault.connect(strategist).pauseCapital();

      // Call swap method
      const tx = await oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      expect(tx).to.emit(oethVault, "Swapped");
    });

    it("Should revert if not called by Governor or Strategist", async () => {
      const { weth, stETH, oethVault, josh } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(josh)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });
  });

  describe("1inch Swapper", () => {
    let fixture;

    beforeEach(async () => {
      fixture = await run1InchFixture();
    });

    it("Should swap assets using 1inch router", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const deadAddr = "0x1111111111222222222233333333334444444444";

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [utils.arrayify(SWAP_SELECTOR), deadAddr, utils.arrayify("0xdead")]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await weth
        .connect(strategist)
        .mintTo(swapper1Inch.address, fromAmount.mul(2));
      await frxETH
        .connect(strategist)
        .mintTo(mock1InchSwapRouter.address, toAmount.mul(2));

      await swapper1Inch.approveAssets([weth.address]);

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx)
        .to.emit(mock1InchSwapRouter, "MockSwapDesc")
        .withArgs(
          weth.address,
          frxETH.address,
          deadAddr,
          strategist.address,
          fromAmount,
          toAmount,
          4
        );

      await expect(tx).to.emit(
        mock1InchSwapRouter,
        "MockSwap"
        // ).withArgs(
        //   deadAddr,
        //   ['0', 'x'],
        //   utils.arrayify("0xdead")
      );

      const r = await (await tx).wait();
      expect(r.logs[3].data).to.equal(
        "0x00000000000000000000000011111111112222222222333333333344444444440000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002dead000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Should swap assets using Uniswap executor", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [
          utils.arrayify(UNISWAP_SELECTOR),
          [BigNumber.from("123"), BigNumber.from("456")],
        ]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await weth
        .connect(strategist)
        .mintTo(swapper1Inch.address, fromAmount.mul(2));
      await frxETH
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));

      await swapper1Inch.approveAssets([weth.address]);

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx)
        .to.emit(mock1InchSwapRouter, "MockUnoswapTo")
        .withArgs(strategist.address, weth.address, fromAmount, toAmount, [
          BigNumber.from("123"),
          BigNumber.from("456"),
        ]);
    });

    it("Should swap assets using Uniswap V3 executor", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [
          utils.arrayify(UNISWAPV3_SELECTOR),
          [BigNumber.from("123"), BigNumber.from("456")],
        ]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await weth
        .connect(strategist)
        .mintTo(swapper1Inch.address, fromAmount.mul(2));
      await frxETH
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx)
        .to.emit(mock1InchSwapRouter, "MockUniswapV3SwapTo")
        .withArgs(strategist.address, fromAmount, toAmount, [
          BigNumber.from("123"),
          BigNumber.from("456"),
        ]);
    });

    it("Should revert swap if fromAsset is insufficient ", async () => {
      const { swapper1Inch, strategist, weth, frxETH } = fixture;

      const deadAddr = "0x1111111111222222222233333333334444444444";

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [utils.arrayify(SWAP_SELECTOR), deadAddr, utils.arrayify("0xdead")]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await frxETH
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("Should revert swap if router allowance is insufficient ", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const deadAddr = "0x1111111111222222222233333333334444444444";

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [utils.arrayify(SWAP_SELECTOR), deadAddr, utils.arrayify("0xdead")]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await weth
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));
      await frxETH
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));

      // Reset allowance
      await weth
        .connect(await impersonateAndFundContract(swapper1Inch.address))
        .approve(mock1InchSwapRouter.address, 0);

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx).to.be.revertedWith(
        "ERC20: transfer amount exceeds allowance"
      );
    });
  });
});
