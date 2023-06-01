const {
  defaultFixture,
  oethDefaultFixtureSetup,
  oeth1InchSwapperFixtureSetup,
  impersonateAndFundContract,
} = require("../_fixture");
const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const runFixture = oethDefaultFixtureSetup();
const run1InchFixture = oeth1InchSwapperFixtureSetup();

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

      const tx = oethVault.connect(governor).setSwapSlippage(weth.address, 123);
      await expect(tx)
        .to.emit(oethVault, "SwapSlippageChanged")
        .withArgs(weth.address, 123);
    });

    it("Should not allow Governor to set slippage for unsupported assets", async () => {
      const { governor, oethVault, dai } = fixture;

      const tx = oethVault.connect(governor).setSwapSlippage(dai.address, 123);
      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("Should not allow anyone else to set slippage for assets", async () => {
      const { strategist, josh, oethVault, weth } = fixture;

      for (const user of [strategist, josh]) {
        const tx = oethVault.connect(user).setSwapSlippage(weth.address, 123);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow to change Swapper address", async () => {
      const { governor, oethVault, weth } = fixture;

      // Pretend WETH is swapper address
      const tx = oethVault.connect(governor).setSwapper(weth.address);

      await expect(tx)
        .to.emit(oethVault, "SwapperChanged")
        .withArgs(weth.address);
    });

    it("Should not allow anyone else to set slippage for assets", async () => {
      const { strategist, josh, oethVault, weth } = fixture;

      for (const user of [strategist, josh]) {
        const tx = oethVault.connect(user).setSwapper(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow to swap tokens", async () => {
      const { weth, reth, stETH, frxETH, oethVault, strategist } = fixture;

      const vaultSigner = await impersonateAndFundContract(oethVault.address);

      for (const asset of [weth, reth, stETH, frxETH]) {
        // Fund Vault with some of the asset
        await asset.connect(vaultSigner).mint(utils.parseEther("100"));

        const toAsset = asset.address === weth.address ? stETH : weth;
        const fromAmount = utils.parseEther("100");
        const toAmount = utils.parseEther("100");

        // Call swap method
        const tx = oethVault
          .connect(strategist)
          .swapCollateral(
            asset.address,
            toAsset.address,
            fromAmount,
            toAmount,
            []
          );

        await expect(tx)
          .to.emit(oethVault, "Swapped")
          .withArgs(asset.address, toAsset.address, fromAmount, toAmount);
      }
    });

    it("Should revert swap if received less tokens than strategist desired", async () => {
      const { weth, stETH, oethVault, strategist, mockSwapper } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("98"));

      // Fund Vault with some WETH
      const vaultSigner = await impersonateAndFundContract(oethVault.address);
      await weth.connect(vaultSigner).mint(utils.parseEther("100"));

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Strategist slippage limit");
    });

    it("Should revert swap if received less tokens than Oracle slippage", async () => {
      const { weth, stETH, oethVault, strategist, mockSwapper } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("50"));

      // Fund Vault with some WETH
      const vaultSigner = await impersonateAndFundContract(oethVault.address);
      await weth.connect(vaultSigner).mint(utils.parseEther("100"));

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("30");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Oracle slippage limit exceeded");
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

    it("Should revert if capital is paused", async () => {
      const { weth, stETH, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await oethVault.connect(strategist).pauseCapital();

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(weth.address, stETH.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Capital paused");
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
        [utils.arrayify("0x12aa3caf"), deadAddr, utils.arrayify("0xdead")]
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
      expect(r.logs[0].data).to.equal(
        "0x00000000000000000000000011111111112222222222333333333344444444440000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002dead000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("Should swap assets using Uniswap executor", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "uint256[]"],
        [
          utils.arrayify("0x0502b1c5"),
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
          utils.arrayify("0xbc80f1a8"),
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
        [utils.arrayify("0x12aa3caf"), deadAddr, utils.arrayify("0xdead")]
      );

      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      await frxETH
        .connect(strategist)
        .mintTo(swapper1Inch.address, toAmount.mul(2));

      const tx = swapper1Inch
        .connect(strategist)
        .swap(weth.address, frxETH.address, fromAmount, toAmount, data);

      await expect(tx).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert swap if router allowance is insufficient ", async () => {
      const { swapper1Inch, strategist, weth, frxETH, mock1InchSwapRouter } =
        fixture;

      const deadAddr = "0x1111111111222222222233333333334444444444";

      const data = utils.defaultAbiCoder.encode(
        ["bytes4", "address", "bytes"],
        [utils.arrayify("0x12aa3caf"), deadAddr, utils.arrayify("0xdead")]
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

      await expect(tx).to.be.revertedWith("Insufficient allowance");
    });
  });
});
