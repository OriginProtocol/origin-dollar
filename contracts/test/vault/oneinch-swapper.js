const { expect } = require("chai");
const { utils, BigNumber } = require("ethers");

const { units, usdsUnits, usdtUnits } = require("../helpers");
const {
  createFixtureLoader,
  oethCollateralSwapFixture,
  ousdCollateralSwapFixture,
  oeth1InchSwapperFixture,
} = require("../_fixture");
const {
  SWAP_SELECTOR,
  UNISWAP_SELECTOR,
  UNISWAPV3_SELECTOR,
} = require("../../utils/1Inch");
const { impersonateAndFund } = require("../../utils/signers");

const log = require("../../utils/logger")("test:oeth:swapper");

describe("1Inch Swapper", () => {
  describe("No OETH Collateral Swaps", () => {
    let fixture;
    const loadFixture = createFixtureLoader(oethCollateralSwapFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Should revert stETH to WETH swap", async () => {
      const { weth, stETH, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(stETH.address, weth.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Collateral swap not supported");
    });

    it("Should revert stETH to WETH swap", async () => {
      const { stETH, weth, oethVault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = oethVault
        .connect(strategist)
        .swapCollateral(stETH.address, weth.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Collateral swap not supported");
    });
  });
  describe("OUSD Collateral Swaps", () => {
    let fixture;
    const loadFixture = createFixtureLoader(ousdCollateralSwapFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
    });

    it("Should allow Governor to set slippage for assets", async () => {
      const { usds, governor, vault } = fixture;

      const tx = vault.connect(governor).setOracleSlippage(usds.address, 123);
      await expect(tx)
        .to.emit(vault, "SwapSlippageChanged")
        .withArgs(usds.address, 123);
    });

    it("Should not allow Governor to set slippage for unsupported assets", async () => {
      const { governor, vault, weth } = fixture;

      const tx = vault.connect(governor).setOracleSlippage(weth.address, 123);
      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("Should not allow anyone else to set slippage for assets", async () => {
      const { usds, strategist, josh, vault } = fixture;

      for (const user of [strategist, josh]) {
        const tx = vault.connect(user).setOracleSlippage(usds.address, 123);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should not allow Governor to set slippage above 10%", async () => {
      const { usds, governor, vault } = fixture;

      const tx = vault.connect(governor).setOracleSlippage(usds.address, 1100);
      await expect(tx).to.be.revertedWith("Slippage too high");
    });

    it("Should allow to change Swapper address", async () => {
      const { governor, vault, weth } = fixture;

      // Pretend WETH is swapper address
      const tx = vault.connect(governor).setSwapper(weth.address);

      await expect(tx).to.emit(vault, "SwapperChanged").withArgs(weth.address);

      expect(await vault.swapper()).to.equal(weth.address);
    });

    it("Should not allow anyone else to set swapper address", async () => {
      const { strategist, josh, vault, weth } = fixture;

      for (const user of [strategist, josh]) {
        const tx = vault.connect(user).setSwapper(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow the governor to change allowed swap undervalue", async () => {
      const { governor, vault } = fixture;

      const tx = vault.connect(governor).setSwapAllowedUndervalue(10);

      await expect(tx)
        .to.emit(vault, "SwapAllowedUndervalueChanged")
        .withArgs(10);

      expect(await vault.allowedSwapUndervalue()).to.equal(10);
    });

    it("Should not allow anyone else to set allowed swap undervalue", async () => {
      const { strategist, josh, vault } = fixture;

      for (const user of [strategist, josh]) {
        const tx = vault.connect(user).setSwapAllowedUndervalue(10);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("Should allow the governor to set allowed swap undervalue to 100%", async () => {
      const { governor, vault } = fixture;

      const hundredPercent = 10000;
      const tx = vault
        .connect(governor)
        .setSwapAllowedUndervalue(hundredPercent);

      await expect(tx)
        .to.emit(vault, "SwapAllowedUndervalueChanged")
        .withArgs(hundredPercent);

      expect(await vault.allowedSwapUndervalue()).to.equal(hundredPercent);
    });

    it("Should not allow setting undervalue percentage over 100%", async () => {
      const { governor, vault } = fixture;

      const tx = vault.connect(governor).setSwapAllowedUndervalue(10001);

      await expect(tx).to.be.revertedWith("Invalid basis points");
    });

    it("Should allow to swap tokens", async () => {
      const { usds, usdc, usdt, vault, strategist } = fixture;

      for (const fromAsset of [usds, usdc, usdt]) {
        for (const toAsset of [usds, usdc, usdt]) {
          if (fromAsset.address === toAsset.address) continue;
          const fromAmount = await units("20", fromAsset);
          const toAmount = await units("21", toAsset);
          log(
            `swapping 20 ${await fromAsset.symbol()} to ${await toAsset.symbol()}`
          );
          expect(await fromAsset.balanceOf(vault.address)).to.gte(fromAmount);

          // Call swap method
          const tx = await vault
            .connect(strategist)
            .swapCollateral(
              fromAsset.address,
              toAsset.address,
              fromAmount,
              toAmount,
              []
            );

          expect(tx)
            .to.emit(vault, "Swapped")
            .withArgs(fromAsset.address, toAsset.address, fromAmount, toAmount);
        }
      }
    });

    it("Should revert swap if received less tokens than strategist desired", async () => {
      const { usds, usdt, vault, strategist, mockSwapper } = fixture;

      // Mock to return lower than slippage next time
      await mockSwapper.connect(strategist).setNextOutAmount(usdsUnits("18"));

      const fromAmount = usdtUnits("20");
      const toAmount = usdsUnits("20");

      // Call swap method
      const tx = vault
        .connect(strategist)
        .swapCollateral(usdt.address, usds.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Strategist slippage limit");
    });

    it("Should revert swap if received less tokens than Oracle slippage", async () => {
      const { usds, usdt, vault, strategist } = fixture;

      const fromAmount = usdtUnits("20");
      const toAmount = usdsUnits("16");

      // Call swap method
      const tx = vault
        .connect(strategist)
        .swapCollateral(usdt.address, usds.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Oracle slippage limit exceeded");
    });

    it("Should revert swap if value is under supply", async () => {
      const { usds, usdt, oeth, vault, governor, strategist, mockSwapper } =
        fixture;

      // Mock to return lower than slippage next time
      await mockSwapper
        .connect(strategist)
        .setNextOutAmount(utils.parseEther("180"));
      // increase the allowed Oracle slippage per asset to 9.99%
      await vault.connect(governor).setOracleSlippage(usds.address, 999);
      await vault.connect(governor).setOracleSlippage(usdt.address, 999);

      const fromAmount = usdtUnits("200");
      const toAmount = usdsUnits("170");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await vault.totalValue()}`);

      // Call swap method
      const tx = vault
        .connect(strategist)
        .swapCollateral(usdt.address, usds.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("Allowed value < supply");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await vault.totalValue()}`);
    });

    it("Should allow swap if value is under supply by less than the allowed percentage", async () => {
      const { usds, usdt, oeth, vault, governor, strategist, mockSwapper } =
        fixture;

      // Mock to return lower than slippage next time
      await mockSwapper.connect(strategist).setNextOutAmount(usdsUnits("19"));
      // increase the allowed Oracle slippage per asset to 9.99%
      await vault.connect(governor).setOracleSlippage(usds.address, 999);
      await vault.connect(governor).setOracleSlippage(usdt.address, 999);

      const fromAmount = usdtUnits("20");
      const toAmount = usdsUnits("17");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await vault.totalValue()}`);

      // Call swap method
      const tx = await vault
        .connect(strategist)
        .swapCollateral(usdt.address, usds.address, fromAmount, toAmount, []);

      await expect(tx).to.emit(vault, "Swapped");

      log(`total supply: ${await oeth.totalSupply()}`);
      log(`total value : ${await vault.totalValue()}`);
    });

    it("Should revert if fromAsset is not supported", async () => {
      const { usds, weth, vault, strategist } = fixture;
      const fromAmount = utils.parseEther("100");
      const toAmount = usdsUnits("100");

      // Call swap method
      const tx = vault
        .connect(strategist)
        .swapCollateral(weth.address, usds.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("From asset is not supported");
    });

    it("Should revert if toAsset is not supported", async () => {
      const { weth, usds, vault, strategist } = fixture;
      const fromAmount = usdsUnits("100");
      const toAmount = utils.parseEther("100");

      // Call swap method
      const tx = vault
        .connect(strategist)
        .swapCollateral(usds.address, weth.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith("To asset is not supported");
    });

    it("Should swap if capital is paused", async () => {
      const { usds, usdt, vault, strategist } = fixture;
      const fromAmount = usdsUnits("100");
      const toAmount = usdtUnits("100");

      // Fund Vault with some assets
      const vaultSigner = await impersonateAndFund(vault.address);
      await usds.connect(vaultSigner).mint(fromAmount);

      await vault.connect(strategist).pauseCapital();

      // Call swap method
      const tx = await vault
        .connect(strategist)
        .swapCollateral(usds.address, usdt.address, fromAmount, toAmount, []);

      expect(tx).to.emit(vault, "Swapped");
    });

    it("Should revert if not called by Governor or Strategist", async () => {
      const { usds, usdt, vault, josh } = fixture;
      const fromAmount = usdsUnits("100");
      const toAmount = usdtUnits("100");

      // Call swap method
      const tx = vault
        .connect(josh)
        .swapCollateral(usds.address, usdt.address, fromAmount, toAmount, []);

      await expect(tx).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });
  });

  describe.skip("1inch Swapper", () => {
    let fixture;
    const loadFixture = createFixtureLoader(oeth1InchSwapperFixture);
    beforeEach(async () => {
      fixture = await loadFixture();
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
        .connect(await impersonateAndFund(swapper1Inch.address))
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
