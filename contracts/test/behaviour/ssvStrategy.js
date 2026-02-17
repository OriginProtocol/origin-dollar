const { expect } = require("chai");
const { AddressZero } = require("@ethersproject/constants");
const {
  setBalance,
  setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const hre = require("hardhat");

const { oethUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { getClusterInfo } = require("../../utils/ssv");
const { parseEther, keccak256 } = require("ethers/lib/utils");
const { setERC20TokenBalance } = require("../_fund");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * @example
    shouldBehaveLikeAnSsvStrategy(() => ({
        ...fixture,
        addresses: [addresses.holesky|addresses.mainnet],
        validatorRegistrator: await impersonateAndFund(
          addresses.holesky.validatorRegistrator
        ),
        ssvNetwork: await ethers.getContractAt(
          "ISSVNetwork",
          addresses.holesky.SSVNetwork
        ),
        nativeStakingFeeAccumulator: await ethers.getContractAt(
          "FeeAccumulator",
          await fixture.nativeStakingSSVStrategy.FEE_ACCUMULATOR_ADDRESS()
        ),
        testValidator: {
          publicKey:
            "0xb279166b18ca9ced3e0a83385799ae33b27c6cd2ad2083b9b7c33c555d091933a09b1af9fb65c6c4d51c40ca931447a9",
          operatorIds: [111, 119, 230, 252],
          sharesData:
            "0xb1edfddfdf70c8c56cfba3f00ae09815db2383c4faa328733df73dd4616492a58648d543642078c72e2bad60a22322d70ea44cc953c05aa0404681fb57498daa9cbd5c8cc98f736c75a8bf908f0eb98d6448b6778f35b1ce724fee8a1bb53f9ab60f29c5fc7c53e1577a27581b8aff689ac2fdeda72e9620f6991edb7779acef68ed2e6ea4ccfaecd00ccac09b7ed8b7abc72ea5c5469e1b5603c73fe3d054e074c88446c4e31abbc34ee309022524da5aacecb4aa83bf0ac658931813a402e4a4b1d9f83d54404b730e04e61dc82e872fa397e3a9ea249715c861ef0d4b309fdba762cd07f0506925a7a4e3e52d2c0e8f07ae01b8bb393df14c17648340c55e3a82564efb943de4033308d197d562c8bf377a589c87e4c7757afe5964ec92a616622138797c4a647dda550e3b94e3a6152cdda20d4a7b491218ab7df46a2eb9c3963811bf0555b272bf4ef5a8c0c2496e133d1cc34b01c7a5cb40d379e607d0bd7f0d8fcb965ab8d5c7634d80dbd3fac67227b53ec6fbd1a5207bfea8cb202ac88fef732328a2b717b6284af9f34a251e5ecf5eb744a4cf4df35abb423ca02556df957cd8bc645b83d497235b92f310996748c54a89106937cfcf182744ad423b104ca0a61a351d15aa9ae98093f64de31e14a7203304021ebbe2ee0e3f91e1641ff7da84396a83643101cfe67640c05467ffa8de458ebb4db0fcffe9210b72c50f8835cb636e1f5e7356092f15b29fb11761ce36a6601d599eb02d82aa02ce300a7e6c538ca72133036e5f3634c29b27c66964f65086e3f725d535f5e7d92f6a0b589a71caa7d0ca572c5192fe6ef5a4b44ad05cbb8c214a444a399b035263a1d2853bfe43b457873e700be599d3ff03532df1f52be09f6607acfc466f8bb4c4d98d74908c7394d516b738a6143a5456dc43a45f1f00a6515e11b5efc6f4dabfb3d967941ac159a8b6f7c464760c4770082b1d97600cabb1dc286d20c321e6bcb36138507915c399d8639d8a66143bff1f5a6d6cb63d0a8b560134dab42e9d23100c05e51104e068c0c76ecb5382d04e34375efea6467dfb096f6dc12b67609ea1d8310044ab8e80f75341b4aa3eb8dd5f465a3dc6b3f1dea8f25c77cdc34f0eb04247c1ac73bde467c8048cc4d57afefcb33de7520048baeaa9401fc175061881d5c60c89a4fe71cf6af8ed7ba3f6b5da42ef2ee5454f422ecf0b02d09f1ba77d35b56240232237810ffe4ff8e49c4a40a9aab7880ea91472440f30b22797f97d90a68e7904513a4267af47d988d96a17c5a2e90c4ad7c6fb56de8ba7e5488cfc16d1015963e2778e2b3def5ffdda1439cf8750b5823e31f4ba59f1eaf17c7ee98a69495a3c38c177175554b343c21f91a708c6313f146bbdde18b1fcead4e0d0274c8c1010c96f79b81060b850ab5c1da001fc908e45b84d57837fbbd272a4349261e500ce56560939cba45a58f2d0bdba3c6631e52d4e0b7a29ea50f14ed36c1ccb5fca6fdc45f881764b3ee39949ef5df255d9afdedfdf390409dadd31df7540d25174cf21a33dce1a2fd6097967be67267aa7e9353db71821bd89db0b3887eebc01cb64a4116edefac323fdde618a34d91545bab38f920e8e6f38b22a3a243b261fd56f0ec1ff6187b3ed42ddeeadf2c7a78c154d44ab332e293ca2b03e77ae1fe628378e336bc73149df4d7cbc86df73d04b9d35a9fe6a87a865f92337a8df10d5a5cf4dcc6cfba73bdd9b13d3b671acfc829b87f869ed42a48ced74099f92ac79721a79ac93d7c4d5e9be780fe1a78f807fd6a222fac05c3c8b9cd4182cb84617abaa72815b5dceec1d58b1278bf90498e4be3a456428866170046c",
          signature:
            "0xa450d596551c7fb7aca201e9a075b034d8da1ec7bf8806740ca53c0e8653465ed9cd26d6ce10290581586676eb0dd896022a243dc42179337c9c4c2a60969a11bb9e4a2dcf57a783daf880999f6db34d1e42163cb96287b3bb91b03361942b80",
          depositDataRoot:
            "0x3f327f69bb527386ff4c2f820e6e375fcc632b1b7ee826bd53d4d2807cfd6769",
        },
    }));
 */

const shouldBehaveLikeAnSsvStrategy = (context) => {
  describe("Initial setup", function () {
    it("Should verify the initial state", async () => {
      const { nativeStakingSSVStrategy, addresses } = await context();
      expect(await nativeStakingSSVStrategy.WETH()).to.equal(
        addresses.WETH,
        "Incorrect WETH address set"
      );
      expect(await nativeStakingSSVStrategy.SSV_TOKEN()).to.equal(
        addresses.SSV,
        "Incorrect SSV Token address"
      );
      expect(await nativeStakingSSVStrategy.SSV_NETWORK()).to.equal(
        addresses.SSVNetwork,
        "Incorrect SSV Network address"
      );
      expect(
        await nativeStakingSSVStrategy.BEACON_CHAIN_DEPOSIT_CONTRACT()
      ).to.equal(
        addresses.beaconChainDepositContract,
        "Incorrect Beacon deposit contract"
      );
      expect(await nativeStakingSSVStrategy.VAULT_ADDRESS()).to.equal(
        addresses.OETHVaultProxy,
        "Incorrect OETH Vault address"
      );
      expect(await nativeStakingSSVStrategy.fuseIntervalStart()).to.equal(
        oethUnits("21.6"),
        "Incorrect fuse start"
      );
      expect(await nativeStakingSSVStrategy.fuseIntervalEnd()).to.equal(
        oethUnits("25.6"),
        "Incorrect fuse end"
      );
      expect(await nativeStakingSSVStrategy.validatorRegistrator()).to.equal(
        addresses.validatorRegistrator,
        "Incorrect validator registrator"
      );
      expect(await nativeStakingSSVStrategy.stakingMonitor()).to.equal(
        addresses.Guardian,
        "Incorrect staking monitor"
      );
      expect(await nativeStakingSSVStrategy.stakeETHThreshold()).to.eq(
        parseEther("512"),
        "stake ETH threshold"
      );
      expect(await nativeStakingSSVStrategy.MAX_VALIDATORS()).to.equal(500);
    });
    it("Anyone should be able to set the MEV fee recipient", async () => {
      const { nativeStakingSSVStrategy, nativeStakingFeeAccumulator, matt } =
        await context();

      const tx = await nativeStakingSSVStrategy.connect(matt).setFeeRecipient();

      const ssvNetworkAddress = await nativeStakingSSVStrategy.SSV_NETWORK();
      const ssvNetwork = await ethers.getContractAt(
        "ISSVNetwork",
        ssvNetworkAddress
      );

      await expect(tx)
        .to.emit(ssvNetwork, "FeeRecipientAddressUpdated")
        .withArgs(
          nativeStakingSSVStrategy.address,
          nativeStakingFeeAccumulator.address
        );
    });
  });

  describe("Deposit/Allocation", function () {
    it("Should accept and handle WETH allocation", async () => {
      const { oethVault, weth, domen, nativeStakingSSVStrategy } =
        await context();
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

  describe("Validator operations", function () {
    const stakeAmount = oethUnits("32");
    const depositToStrategy = async (amount) => {
      const { weth, domen, nativeStakingSSVStrategy, oethVault } =
        await context();

      // Add enough WETH to the Vault so it can be deposited to the strategy
      // This needs to take into account any withdrawal queue shortfall
      const wethBalance = await weth.balanceOf(oethVault.address);
      const queue = await oethVault.withdrawalQueueMetadata();
      const available = wethBalance.add(queue.claimed).sub(queue.queued);
      const transferAmount = amount.sub(available);
      if (transferAmount.gt(0)) {
        await weth.connect(domen).transfer(oethVault.address, transferAmount);
      }

      const sStrategist = await ethers.provider.getSigner(
        await oethVault.strategistAddr()
      );

      // Deposit to the strategy
      return await oethVault
        .connect(sStrategist)
        .depositToStrategy(
          nativeStakingSSVStrategy.address,
          [weth.address],
          [amount]
        );
    };

    const registerAndStakeEth = async () => {
      const {
        addresses,
        weth,
        ssv,
        nativeStakingSSVStrategy,
        validatorRegistrator,
        testValidator,
      } = await context();

      const strategyWethBalanceBefore = await weth.balanceOf(
        nativeStakingSSVStrategy.address
      );

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorids: testValidator.operatorIds,
        chainId: hre.network.config.chainId,
        ssvNetwork: addresses.SSVNetwork,
      });

      await setERC20TokenBalance(
        nativeStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      expect(
        await nativeStakingSSVStrategy.validatorsStates(
          keccak256(testValidator.publicKey)
        )
      ).to.equal(0, "Validator state not 0 (NON_REGISTERED)");

      // Register a new validator with the SSV Network
      const ssvAmount = oethUnits("2");
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidators(
          [testValidator.publicKey],
          testValidator.operatorIds,
          [testValidator.sharesData],
          ssvAmount,
          cluster
        );
      await expect(regTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorRegistered")
        .withArgs(
          keccak256(testValidator.publicKey),
          testValidator.publicKey,
          testValidator.operatorIds
        );

      expect(
        await nativeStakingSSVStrategy.validatorsStates(
          keccak256(testValidator.publicKey)
        )
      ).to.equal(1, "Validator state not 1 (REGISTERED)");

      // Stake stakeAmount ETH to the new validator
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
        .withArgs(
          keccak256(testValidator.publicKey),
          testValidator.publicKey,
          oethUnits("32")
        );

      expect(
        await nativeStakingSSVStrategy.validatorsStates(
          keccak256(testValidator.publicKey)
        )
      ).to.equal(2, "Validator state not 2 (STAKED)");

      expect(await weth.balanceOf(nativeStakingSSVStrategy.address)).to.equal(
        strategyWethBalanceBefore.sub(
          stakeAmount,
          "strategy WETH not decreased"
        )
      );
    };

    beforeEach(async function () {
      const { addresses, nativeStakingSSVStrategy } = await context();

      // Skip these tests if the Native Staking Strategy is full
      const activeValidators =
        await nativeStakingSSVStrategy.activeDepositedValidators();
      if (activeValidators.gte(500)) {
        this.skip();
        return;
      }

      const stakingMonitorSigner = await impersonateAndFund(addresses.Guardian);
      await nativeStakingSSVStrategy
        .connect(stakingMonitorSigner)
        .resetStakeETHTally();
    });

    it("Should register and stake 32 ETH by validator registrator", async () => {
      await depositToStrategy(oethUnits("32"));
      await registerAndStakeEth();
    });

    it("Should fail to register a validator twice", async () => {
      const {
        addresses,
        ssv,
        ssvNetwork,
        nativeStakingSSVStrategy,
        validatorRegistrator,
        testValidator,
      } = await context();

      await depositToStrategy(stakeAmount);

      await setERC20TokenBalance(
        nativeStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorids: testValidator.operatorIds,
        chainId: hre.network.config.chainId,
        ssvNetwork: addresses.SSVNetwork,
      });

      // Register a new validator the first time
      const ssvAmount = oethUnits("3");
      const tx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidators(
          [testValidator.publicKey],
          testValidator.operatorIds,
          [testValidator.sharesData],
          ssvAmount,
          cluster
        );

      const receipt = await tx.wait();
      const { chainId } = await ethers.provider.getNetwork();
      const validatorAddedEvent = ssvNetwork.interface.parseLog(
        receipt.events[chainId === 1 ? 3 : 2]
      );

      // Try to register the same validator again in a different cluster
      const tx2 = nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidators(
          [testValidator.publicKey],
          [1, 20, 300, 4000],
          [testValidator.sharesData],
          ssvAmount,
          validatorAddedEvent.args.cluster
        );

      await expect(tx2).to.be.revertedWith("Validator already registered");
    });

    it("Should emit correct values in deposit event", async () => {
      const { weth, nativeStakingSSVStrategy } = await context();

      await depositToStrategy(oethUnits("40"));
      // at least 8 WETH has remained on the contract and a deposit all
      // event should emit a correct amount
      await registerAndStakeEth();

      /* deposit to strategy calls depositAll on the strategy contract after sending the WETH
       * to it. The event should contain only the amount of newly deposited WETH and not include
       * the pre-exiting WETH.
       */
      const tx = await depositToStrategy(parseEther("10"));

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "Deposit")
        .withArgs(weth.address, AddressZero, parseEther("10"));
    });

    it("Should register and stake 32 ETH even if half supplied by a 3rd party", async () => {
      const { weth, domen, nativeStakingSSVStrategy } = await context();

      await depositToStrategy(oethUnits("16"));
      // A malicious actor is sending WETH directly to the native staking contract hoping to
      // mess up the accounting.
      await weth
        .connect(domen)
        .transfer(nativeStakingSSVStrategy.address, oethUnits("16"));

      await registerAndStakeEth();
    });

    it("Should exit and remove validator by validator registrator", async () => {
      const {
        ssv,
        nativeStakingSSVStrategy,
        ssvNetwork,
        validatorRegistrator,
        addresses,
        testValidator,
      } = await context();
      await depositToStrategy(oethUnits("32"));

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorids: testValidator.operatorIds,
        chainId: hre.network.config.chainId,
        ssvNetwork: addresses.SSVNetwork,
      });

      await setERC20TokenBalance(
        nativeStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      // Register a new validator with the SSV network
      const ssvAmount = oethUnits("4");
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidators(
          [testValidator.publicKey],
          testValidator.operatorIds,
          [testValidator.sharesData],
          ssvAmount,
          cluster
        );
      const regReceipt = await regTx.wait();
      const ValidatorAddedRawEvent = regReceipt.events.find(
        (e) => e.address.toLowerCase() == ssvNetwork.address.toLowerCase()
      );
      const ValidatorAddedEvent = ssvNetwork.interface.parseLog(
        ValidatorAddedRawEvent
      );
      const { cluster: newCluster } = ValidatorAddedEvent.args;

      // Stake 32 ETH to the new validator
      await nativeStakingSSVStrategy.connect(validatorRegistrator).stakeEth([
        {
          pubkey: testValidator.publicKey,
          signature: testValidator.signature,
          depositDataRoot: testValidator.depositDataRoot,
        },
      ]);

      // exit validator from SSV network
      const exitTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .exitSsvValidator(testValidator.publicKey, testValidator.operatorIds);

      await expect(exitTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorExitInitiated")
        .withArgs(
          keccak256(testValidator.publicKey),
          testValidator.publicKey,
          testValidator.operatorIds
        );

      const removeTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          newCluster
        );

      await expect(removeTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorExitCompleted")
        .withArgs(
          keccak256(testValidator.publicKey),
          testValidator.publicKey,
          testValidator.operatorIds
        );
    });

    it("Should remove registered validator by validator registrator", async () => {
      const {
        ssv,
        nativeStakingSSVStrategy,
        ssvNetwork,
        validatorRegistrator,
        addresses,
        testValidator,
      } = await context();
      await depositToStrategy(oethUnits("32"));

      const { cluster } = await getClusterInfo({
        ownerAddress: nativeStakingSSVStrategy.address,
        operatorids: testValidator.operatorIds,
        chainId: hre.network.config.chainId,
        ssvNetwork: addresses.SSVNetwork,
      });

      await setERC20TokenBalance(
        nativeStakingSSVStrategy.address,
        ssv,
        "1000",
        hre
      );

      // Register a new validator with the SSV network
      const ssvAmount = oethUnits("4");
      const regTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .registerSsvValidators(
          [testValidator.publicKey],
          testValidator.operatorIds,
          [testValidator.sharesData],
          ssvAmount,
          cluster
        );
      const regReceipt = await regTx.wait();
      const ValidatorAddedRawEvent = regReceipt.events.find(
        (e) => e.address.toLowerCase() == ssvNetwork.address.toLowerCase()
      );
      const ValidatorAddedEvent = ssvNetwork.interface.parseLog(
        ValidatorAddedRawEvent
      );
      const { cluster: newCluster } = ValidatorAddedEvent.args;

      const removeTx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .removeSsvValidator(
          testValidator.publicKey,
          testValidator.operatorIds,
          newCluster
        );

      await expect(removeTx)
        .to.emit(nativeStakingSSVStrategy, "SSVValidatorExitCompleted")
        .withArgs(
          keccak256(testValidator.publicKey),
          testValidator.publicKey,
          testValidator.operatorIds
        );
    });
  });

  describe("Accounting for ETH", function () {
    let strategyBalanceBefore;
    let consensusRewardsBefore;
    let activeDepositedValidatorsBefore = 30000;
    beforeEach(async () => {
      const {
        nativeStakingSSVStrategy,
        simpleOETHHarvester,
        validatorRegistrator,
        weth,
      } = await context();

      // clear any ETH sitting in the strategy
      await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();
      // Clear out any consensus rewards
      // prettier-ignore
      await simpleOETHHarvester
        .connect(validatorRegistrator)["harvestAndTransfer(address)"](nativeStakingSSVStrategy.address);

      // Set the number validators to a high number
      await setStorageAt(
        nativeStakingSSVStrategy.address,
        52, // the storage slot
        activeDepositedValidatorsBefore
      );

      strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );
      consensusRewardsBefore =
        await nativeStakingSSVStrategy.consensusRewards();
    });

    it("Should account for new consensus rewards", async () => {
      const { nativeStakingSSVStrategy, validatorRegistrator, weth } =
        await context();

      const rewards = oethUnits("2");

      // simulate consensus rewards
      await setBalance(
        nativeStakingSSVStrategy.address,
        consensusRewardsBefore.add(rewards)
      );

      const tx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingConsensusRewards")
        .withArgs(rewards);

      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(strategyBalanceBefore, "checkBalance should not increase");
      expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
        consensusRewardsBefore.add(rewards),
        "consensusRewards should increase"
      );
    });
    it("Should account for withdrawals and consensus rewards", async () => {
      const {
        oethVault,
        nativeStakingSSVStrategy,
        validatorRegistrator,
        weth,
      } = await context();

      const rewards = oethUnits("3");
      const withdrawals = oethUnits("64");
      const expectedConsensusRewards = rewards.sub(
        await nativeStakingSSVStrategy.consensusRewards()
      );
      const vaultWethBalanceBefore = await weth.balanceOf(oethVault.address);

      // simulate withdraw of 2 validators and consensus rewards
      await setBalance(
        nativeStakingSSVStrategy.address,
        withdrawals.add(rewards)
      );

      const tx = await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      expect(
        await nativeStakingSSVStrategy.provider.getBalance(
          nativeStakingSSVStrategy.address
        ),
        rewards,
        "ETH balance after"
      );

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingFullyWithdrawnValidator")
        .withArgs(2, activeDepositedValidatorsBefore - 2, withdrawals);

      await expect(tx)
        .to.emit(nativeStakingSSVStrategy, "AccountingConsensusRewards")
        .withArgs(expectedConsensusRewards);

      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(
        strategyBalanceBefore.sub(withdrawals),
        "checkBalance should decrease"
      );
      expect(await nativeStakingSSVStrategy.consensusRewards()).to.equal(
        consensusRewardsBefore.add(expectedConsensusRewards),
        "consensusRewards should increase"
      );
      expect(
        await nativeStakingSSVStrategy.activeDepositedValidators()
      ).to.equal(
        activeDepositedValidatorsBefore - 2,
        "active validators decreases"
      );
      expect(await weth.balanceOf(oethVault.address)).to.equal(
        vaultWethBalanceBefore.add(withdrawals, "WETH in vault should increase")
      );
    });
  });

  describe("Harvest", async function () {
    it("Should account for new execution rewards", async () => {
      const {
        simpleOETHHarvester,
        josh,
        nativeStakingSSVStrategy,
        nativeStakingFeeAccumulator,
        oethFixedRateDripperProxy,
        weth,
        validatorRegistrator,
      } = await context();
      const dripperWethBefore = await weth.balanceOf(
        oethFixedRateDripperProxy.address
      );
      const strategyBalanceBefore = await nativeStakingSSVStrategy.checkBalance(
        weth.address
      );
      const feeAccumulatorBefore =
        await nativeStakingFeeAccumulator.provider.getBalance(
          nativeStakingFeeAccumulator.address
        );

      // add some ETH to the FeeAccumulator to simulate execution rewards
      const executionRewards = parseEther("7");
      //await setBalance(nativeStakingFeeAccumulator.address, executionRewards);
      await josh.sendTransaction({
        to: nativeStakingFeeAccumulator.address,
        value: executionRewards.sub(feeAccumulatorBefore),
      });

      // simulate consensus rewards
      const consensusRewards = parseEther("5");
      await setBalance(nativeStakingSSVStrategy.address, consensusRewards);
      // account for the consensus rewards

      await nativeStakingSSVStrategy
        .connect(validatorRegistrator)
        .doAccounting();

      // prettier-ignore
      const tx = await simpleOETHHarvester
        .connect(josh)["harvestAndTransfer(address)"](nativeStakingSSVStrategy.address);

      await expect(tx)
        .to.emit(simpleOETHHarvester, "Harvested")
        .withArgs(
          nativeStakingSSVStrategy.address,
          weth.address,
          executionRewards.add(consensusRewards),
          oethFixedRateDripperProxy.address
        );
      // check balances after
      expect(
        await nativeStakingSSVStrategy.checkBalance(weth.address)
      ).to.equal(strategyBalanceBefore, "checkBalance should not increase");

      expect(await weth.balanceOf(oethFixedRateDripperProxy.address)).to.equal(
        dripperWethBefore.add(executionRewards).add(consensusRewards),
        "Vault WETH balance should increase"
      );
    });
  });
};

module.exports = { shouldBehaveLikeAnSsvStrategy };