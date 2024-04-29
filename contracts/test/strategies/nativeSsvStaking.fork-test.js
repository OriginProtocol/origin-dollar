const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");

const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { getClusterInfo } = require("../../utils/ssv");

const {
  createFixtureLoader,
  nativeStakingSSVStrategyFixture,
} = require("./../_fixture");

const loadFixture = createFixtureLoader(nativeStakingSSVStrategyFixture);

describe("ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  // this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { nativeStakingSSVStrategy } = fixture;
      await expect(
        await nativeStakingSSVStrategy.WETH_TOKEN_ADDRESS()
      ).to.equal(addresses.mainnet.WETH, "Incorrect WETH address set");
      await expect(await nativeStakingSSVStrategy.SSV_TOKEN_ADDRESS()).to.equal(
        addresses.mainnet.SSV,
        "Incorrect SSV Token address"
      );
      await expect(
        await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS()
      ).to.equal(addresses.mainnet.SSVNetwork, "Incorrect SSV Network address");
      await expect(
        await nativeStakingSSVStrategy.BEACON_CHAIN_DEPOSIT_CONTRACT()
      ).to.equal(
        addresses.mainnet.beaconChainDepositContract,
        "Incorrect Beacon deposit contract"
      );
      await expect(await nativeStakingSSVStrategy.VAULT_ADDRESS()).to.equal(
        addresses.mainnet.OETHVaultProxy,
        "Incorrect OETH Vault address"
      );
      await expect(await nativeStakingSSVStrategy.fuseIntervalStart()).to.equal(
        oethUnits("21.6"),
        "Incorrect fuse start"
      );
      await expect(await nativeStakingSSVStrategy.fuseIntervalEnd()).to.equal(
        oethUnits("25.6"),
        "Incorrect fuse end"
      );
      await expect(
        await nativeStakingSSVStrategy.validatorRegistrator()
      ).to.equal(
        addresses.mainnet.validatorRegistrator,
        "Incorrect validator registrator"
      );
    });
  });

  describe("Deposit/Allocation", function () {
    it("Should accept and handle WETH allocation", async () => {
      const { oethVault, weth, domen, nativeStakingSSVStrategy } = fixture;
      const fakeVaultSigner = await impersonateAndFund(oethVault.address);

      const depositAmount = oethUnits("32");
      const wethBalanceBefore = await weth.balanceOf(
        nativeStakingSSVStrategy.address
      );
      const strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );

      // Transfer some WETH to strategy
      await weth
        .connect(domen)
        .transfer(nativeStakingSSVStrategy.address, depositAmount);

      // Call deposit by impersonating the Vault
      const tx = await nativeStakingSSVStrategy
        .connect(fakeVaultSigner)
        .deposit(weth.address, depositAmount);

      expect(tx)
        .to.emit(nativeStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, AddressZero, depositAmount);

      expect(await weth.balanceOf(nativeStakingSSVStrategy.address)).to.equal(
        wethBalanceBefore.add(depositAmount),
        "WETH not transferred"
      );
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        strategyBalanceBefore.add(depositAmount),
        "strategy checkBalance not increased"
      );
    });
  });

  describe("Spin up a new validator", function () {
    const testValidator = {
      publicKey:
        "0xad9ade40c386259fe4161ec12d7746ab49a098a4760a279c56dc7e26b56fc4d985e74eeecdd2bc5a1decceb5174204f4",
      operatorIds: [193, 196, 199, 202],
      sharesData:
        "0x8308e4b6ad536304f978077a0cd3685a98d5847bb1b05e0a4c5994ddf64ce48daa917f666d86f3125aac139a4fc7b07119ea2c7fc0fe5cfb316a5687dbddf621b0229e55230f0857d426697513ee2556d2c730595268358ebe8e16331bd2dd53acfd93e4e96c5fb510f78dc0f11e5097f83b2609a5711b233fa843935125dbbd90e43dc4f7d181221a42fcc02fe58aeb90fefb6a1d46faad099b6fa8e68351ff21f52d90a96bffeb33d1c0517bf39e413a441f1c290f1289021e9bd47146689ba139bccfaf7d6d1a6fba03c177d9ffca11f347b0f16a1cd8b1808a9b46ec0849ff45562a853ea137dfea3a0ed43ceac5805a993edd6b618cf7aa1441b2deeb2a7a573f0a44d9ed6bffb75573a91e9de2c21e198815d9b133ce7060ff339bf23b12af3c15f566b81842f307066205f09b40b4db045af881f5ca571289d1aa52555002544e8941b854b1b565b5e76c845c4b287a46890d6ad3e01185d2fb5485ecb136814a23378d37ff53244c1420af43db268f74bf0532dd235cb2afd49d1dce7158d1f51650bc32b790f29bdfc2bafc9990a55a15d005139c6ede259a6a9426400d67192ec697a8990c326bc63fe8a809515d0cc311059da2e333cb92331c45ac8b8d2e09a8cc4092016ade9f90a4b1a89a89f9da38818a5a77f84ae2aba340719dc6a01810ddfcd9e9cf9ebfab033363d2a58296cd1ab8e33ea4e04738111a3e2d80d34c601b0b49e95412cdd554a844f02a94f7f239e70cb72247c36218de79b5d0d73a7429cccf1999eca2611b1c486e8148451cac60bc60280764948f54100a39d9290c368a2ace60daa3ff1bf9dd7514afd02397c196b9cee8ef94478619a114cbebdf4475053857f2728c7621c5fb6739cbf8a15727c5d15a354e20ac054f31e51288a4f94a4215d00d23d2e5a82f745f2f15d6b147ecf817165913f2f72f492075de8f339efe54f163311f7de056c36a900949f7f026c17a96770edd29ba0301732bb83d218a0fb28d466858118e7240725ee74a45fd3acf8ca7310cb72f6cb3c6f8517b89984ad622ffeb39dad587d2e944d59fe849841fc5f09e9f1935cc59b10c795446eb18a2f87e6ee1a497fe0bb556164cd2d7b5c7cf5fdb758e8fc26711116bf59a08be68d2ddb9a97300d2ac43055877a0cc3be97c8b82ceb5dd59f6222c23d849dc7620ffca0393d685cb609059e0e8a76500c9c92d7878a3939c346897d10c6707d39bd10d0f546f6506b6b087dea16156478e11d9537d169d582ca26a04dceede25a38b5a4bf2e16db9db97bdb320f198632a0b60af8ebdf3e6a0bda19f34c9ddc7e437d3fef3da021cae41dd99d2898d825db9de51561dee2a5587fa75453609fff5aec3e949a34fd438f00ab6dbca03e385059003936db14c66d4fec38d6ba729051866c336c51c802507dc5b16b591a4905636736a05bbd0d39ba965de131abad34797e3521ff01612b1bd17aca6af61abf8bd24182a1e2848fc41819c0ce7065000747023db82de23eef601ed7cdaffd39b005e8bb8156f4986d9825e62cd2f13f8c0e33e5825e8d81730ef1a63dfd19af6afd08f9f102f403783dca89173456d9e60fb72b2c153bf0bb73bed799a15eb94923f7cadd9c9bc529a86051d8202b1af53ccb161179f9c4609084dd977091082fc14c20ff21efd70bb9ca56b0ea80c7fc16e2f1718c7b306944fa6c7572440c7d6035a22cea8858f64bb3b6d147a05743021ca1b79d71bac87888bb5fd343b1817a28dda336f1d640f8adae159020deba8d3e1e97ae0b9a4ba23112e59d93169a7b875fc878f66f13b2568ed326f9da7ba6c2bd08d37f5b0ef6bfe56febe20e366fa9d",
      signature:
        "0xadf71438600db72305e4a277554c06359d25e59480e2c4d5ea9d12d132088893d2df141c60a0857c63edc10b9800ac0e0e3e3dcd7b5fdfbcab8fbf377816811becc8be9420c17a725dff9dac6653230b9c5c04fd2ea19f9313fe943e1a562a18",
      depositDataRoot:
        "0x0d12c28849771f3f946d8d705a1f73683d97add9edaec5e6b30650cc03bc57d5",
    };

    beforeEach(async () => {
      const { nativeStakingSSVStrategy, ssv } = fixture;
      // Add some ETH to the Defender Relayer account
      // TODO this can be removed once the account is funded on mainnet
      await impersonateAndFund(addresses.mainnet.validatorRegistrator, 1);

      // Fund some SSV to the native staking strategy
      const ssvWhale = await impersonateAndFund(
        "0xf977814e90da44bfa03b6295a0616a897441acec" // Binance 8
      );
      await ssv
        .connect(ssvWhale)
        .transfer(nativeStakingSSVStrategy.address, oethUnits("100"));
    });

    it("Should register and staked 32 ETH by validator registrator", async () => {
      const { weth, domen, nativeStakingSSVStrategy, validatorRegistrator } =
        fixture;
      // Add 32 WETH to the strategy so it can be staked
      await weth
        .connect(domen)
        .transfer(nativeStakingSSVStrategy.address, oethUnits("32"));
      const strategyWethBalanceBefore = await weth.balanceOf(
        nativeStakingSSVStrategy.address
      );

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorIds: testValidator.operatorIds,
        chainId: 1,
        ssvNetwork: addresses.mainnet.SSVNetwork,
      });
      const stakeAmount = oethUnits("32");

      // Register a new validator with the SSV Network
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          testValidator.sharesData,
          stakeAmount,
          cluster
        );
      await expect(regTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorRegistered")
        .withArgs(testValidator.publicKey, testValidator.operatorIds);

      // Stake 32 ETH to the new validator
      const stakeTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .stakeEth([
          {
            pubkey: testValidator.publicKey,
            signature: testValidator.signature,
            depositDataRoot: testValidator.depositDataRoot,
          },
        ]);

      await expect(stakeTx)
        .to.emit(nativeStakingSSVStrategy, "ETHStaked")
        .withNamedArgs({
          pubkey: testValidator.publicKey,
          amount: stakeAmount,
        });

      expect(await weth.balanceOf(nativeStakingSSVStrategy.address)).to.equal(
        strategyWethBalanceBefore.sub(
          stakeAmount,
          "strategy WETH not decreased"
        )
      );
    });
  });

  describe("ETH rewards", function () {
    it("Should account for new consensus rewards", async () => {
      // check balance should not increase
    });
    it("Strategist should account for new execution rewards", async () => {
      // check balance should not increase
    });
  });

  describe("Withdraw", function () {
    it("Should account for full withdrawal from validator", async () => {
      // check balance should not increase after sweep but before accounting
      // check balance should increase after accounting
      // check balance should decrease after withdrawal
      // WETH in vault should decrease after withdrawal
    });
  });

  describe("Balance/Assets", function () {});
});
