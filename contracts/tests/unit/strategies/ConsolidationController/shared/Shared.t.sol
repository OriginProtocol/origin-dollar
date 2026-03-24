// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockSSVNetwork} from "contracts/mocks/MockSSVNetwork.sol";
import {MockSSV} from "contracts/mocks/MockSSV.sol";
import {MockDepositContract} from "contracts/mocks/MockDepositContract.sol";
import {MockBeaconProofs} from "contracts/mocks/beacon/MockBeaconProofs.sol";
import {MockBeaconRoots} from "tests/mocks/MockBeaconRoots.sol";
import {MockWithdrawalRequest} from "tests/mocks/MockWithdrawalRequest.sol";
import {MockConsolidationRequest} from "tests/mocks/MockConsolidationRequest.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {ValidatorStakeData} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";
import {FeeAccumulator} from "contracts/strategies/NativeStaking/FeeAccumulator.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";
import {ConsolidationController} from "contracts/strategies/NativeStaking/ConsolidationController.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";

abstract contract Unit_ConsolidationController_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES (moved from Base)
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    MockSSVNetwork internal mockSsvNetwork;
    MockSSV internal mockSsv;
    MockDepositContract internal mockDepositContract;
    MockBeaconProofs internal mockBeaconProofs;
    OETH internal oeth;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy2;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy3;
    CompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    ConsolidationController internal consolidationController;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // Beacon chain constants
    uint64 internal constant BEACON_GENESIS_TIMESTAMP = 1_600_000_000;
    uint64 internal constant SLOT_DURATION = 12;
    uint64 internal constant SLOTS_PER_EPOCH = 32;
    uint64 internal constant SNAP_BALANCES_DELAY = 35 * SLOT_DURATION;

    // MIN_CONSOLIDATION_PERIOD = 261 * 32 * 12 = 100224 seconds
    uint256 internal constant MIN_CONSOLIDATION_PERIOD = 261 * 32 * 12;

    // Consolidation fee
    uint256 internal constant CONSOLIDATION_FEE = 5e6;

    // Storage slots for NativeStakingSSVStrategy
    uint256 internal constant ACTIVE_DEPOSITED_VALIDATORS_SLOT = 52;

    // Test pub keys (48 bytes each)
    bytes internal constant TEST_PUB_KEY_1 =
        hex"aba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25";
    bytes internal constant TEST_PUB_KEY_2 =
        hex"a8adaec39a6738b09053a3ed9d44e481d5b2dfafefe0059da48756db951adf4f2956c1149f3bd0634e4cde009a770afb";
    bytes internal constant TEST_PUB_KEY_3 =
        hex"aa8cdeb9efe0cb2f703332a46051214464796e7de7b882abd243c175b2d96250ad227846f713876445f864b2e2f695c1";

    // Invalid pub key (32 bytes - wrong length)
    bytes internal constant INVALID_PUB_KEY = hex"0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";

    // Target pub key for the compounding strategy
    bytes internal constant TARGET_PUB_KEY =
        hex"b5d37226e27e0ab066541ccb795e04149300bb8c0b0fd528785f6a940e94c624b65ef1eb771f78a5f2685317b7e6f34f";

    // Operator IDs
    uint64[4] internal testOperatorIds = [uint64(348), uint64(352), uint64(361), uint64(377)];

    // Test validator data (for NativeStakingSSVStrategy)
    bytes internal constant TEST_SHARES_DATA =
        hex"859f01c8f609cb5cb91f0c98e9b39b077775f10302d0db0edc4ea65e692c97920d5169f6281845a956404c0ba90b8806";
    bytes internal constant TEST_SIGNATURE =
        hex"90157a1c1b26384f0b4d41bec867d1a000f75e7b634ac7c4c6d8dfc0b0eaeb73bcc99586333d42df98c6b0a8c5ef0d8d071c68991afcd8fbbaa8b423e3632ee4fe0782bc03178a30a8bc6261f64f84a6c833fb96a0f29de1c34ede42c4a859b0";
    bytes32 internal constant TEST_DEPOSIT_DATA_ROOT =
        0xdbe778a625c68446f3cc8b2009753a5e7dd7c37b8721ee98a796bb9179dfe8ac;

    // Additional local contracts
    FeeAccumulator internal nativeStakingFeeAccumulator2;
    FeeAccumulator internal nativeStakingFeeAccumulator3;

    // Mock contracts for precompiles
    MockBeaconRoots internal mockBeaconRootsContract;
    MockWithdrawalRequest internal mockWithdrawalRequestContract;
    MockConsolidationRequest internal mockConsolidationRequestContract;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        // Set block timestamp well after beacon genesis
        vm.warp(BEACON_GENESIS_TIMESTAMP + 1_000_000);

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy mocks
        mockWeth = new MockWETH();
        mockSsvNetwork = new MockSSVNetwork();
        mockSsv = new MockSSV();
        mockDepositContract = new MockDepositContract();
        mockBeaconProofs = new MockBeaconProofs();

        // Deploy and etch MockBeaconRoots at EIP-4788 address
        mockBeaconRootsContract = new MockBeaconRoots();
        vm.etch(0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02, address(mockBeaconRootsContract).code);
        mockBeaconRootsContract = MockBeaconRoots(payable(0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02));

        // Deploy and etch MockWithdrawalRequest at EIP-7002 address
        mockWithdrawalRequestContract = new MockWithdrawalRequest();
        vm.etch(0x00000961Ef480Eb55e80D19ad83579A64c007002, address(mockWithdrawalRequestContract).code);
        mockWithdrawalRequestContract = MockWithdrawalRequest(payable(0x00000961Ef480Eb55e80D19ad83579A64c007002));

        // Deploy and etch MockConsolidationRequest at EIP-7251 address
        mockConsolidationRequestContract = new MockConsolidationRequest();
        vm.etch(0x0000BBdDc7CE488642fb579F8B00f3a590007251, address(mockConsolidationRequestContract).code);
        mockConsolidationRequestContract = MockConsolidationRequest(payable(0x0000BBdDc7CE488642fb579F8B00f3a590007251));

        // Deploy OETH + OETHVault through proxies
        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(mockWeth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy NativeStakingSSVStrategy2 (old staking strategy #2)
        _deployNativeStakingStrategy2();

        // Deploy NativeStakingSSVStrategy3 (old staking strategy #3)
        _deployNativeStakingStrategy3();

        // Deploy CompoundingStakingSSVStrategy (new target strategy)
        _deployCompoundingStakingStrategy();

        // Deploy ConsolidationController
        consolidationController = new ConsolidationController(
            guardian, // owner (admin multisig)
            governor, // validatorRegistrator
            address(nativeStakingSSVStrategy2),
            address(nativeStakingSSVStrategy3),
            address(compoundingStakingSSVStrategy)
        );

        // Wire up: set registrator on old strategies to ConsolidationController
        vm.startPrank(governor);
        nativeStakingSSVStrategy2.setRegistrator(address(consolidationController));
        nativeStakingSSVStrategy3.setRegistrator(address(consolidationController));
        // Set registrator on compounding strategy to ConsolidationController
        compoundingStakingSSVStrategy.setRegistrator(address(consolidationController));
        vm.stopPrank();

        // Assign weth
        weth = IERC20(address(mockWeth));

        // Fund josh with WETH by depositing ETH
        vm.deal(josh, 10_000 ether);
        vm.prank(josh);
        mockWeth.deposit{value: 10_000 ether}();
    }

    function _deployNativeStakingStrategy2() internal {
        // Predict strategy address for FeeAccumulator circular dependency
        uint64 nonce = vm.getNonce(address(this));
        address predictedStrategy = vm.computeCreateAddress(address(this), nonce + 1);

        // Deploy FeeAccumulator first with predicted strategy address
        nativeStakingFeeAccumulator2 = new FeeAccumulator(predictedStrategy);

        // Deploy NativeStakingSSVStrategy2
        nativeStakingSSVStrategy2 = new NativeStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(oethVault)
            }),
            address(mockWeth),
            address(mockSsv),
            address(mockSsvNetwork),
            256,
            address(nativeStakingFeeAccumulator2),
            address(mockDepositContract)
        );

        // Set governor via storage slot
        vm.store(address(nativeStakingSSVStrategy2), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize and configure
        vm.startPrank(governor);

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(mockWeth);
        address[] memory emptyAddresses = new address[](0);

        nativeStakingSSVStrategy2.initialize(rewardTokens, emptyAddresses, emptyAddresses);
        oethVault.approveStrategy(address(nativeStakingSSVStrategy2));
        nativeStakingSSVStrategy2.setRegistrator(governor);
        nativeStakingSSVStrategy2.setFuseInterval(21.6 ether, 25.6 ether);
        nativeStakingSSVStrategy2.setStakingMonitor(matt);
        nativeStakingSSVStrategy2.setStakeETHThreshold(64 ether);
        nativeStakingSSVStrategy2.setHarvesterAddress(nick);

        vm.stopPrank();
    }

    function _deployNativeStakingStrategy3() internal {
        // Predict strategy address for FeeAccumulator circular dependency
        uint64 nonce = vm.getNonce(address(this));
        address predictedStrategy = vm.computeCreateAddress(address(this), nonce + 1);

        // Deploy FeeAccumulator first with predicted strategy address
        nativeStakingFeeAccumulator3 = new FeeAccumulator(predictedStrategy);

        // Deploy NativeStakingSSVStrategy3
        nativeStakingSSVStrategy3 = new NativeStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(oethVault)
            }),
            address(mockWeth),
            address(mockSsv),
            address(mockSsvNetwork),
            256,
            address(nativeStakingFeeAccumulator3),
            address(mockDepositContract)
        );

        // Set governor via storage slot
        vm.store(address(nativeStakingSSVStrategy3), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize and configure
        vm.startPrank(governor);

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(mockWeth);
        address[] memory emptyAddresses = new address[](0);

        nativeStakingSSVStrategy3.initialize(rewardTokens, emptyAddresses, emptyAddresses);
        oethVault.approveStrategy(address(nativeStakingSSVStrategy3));
        nativeStakingSSVStrategy3.setRegistrator(governor);
        nativeStakingSSVStrategy3.setFuseInterval(21.6 ether, 25.6 ether);
        nativeStakingSSVStrategy3.setStakingMonitor(matt);
        nativeStakingSSVStrategy3.setStakeETHThreshold(64 ether);
        nativeStakingSSVStrategy3.setHarvesterAddress(nick);

        vm.stopPrank();
    }

    function _deployCompoundingStakingStrategy() internal {
        compoundingStakingSSVStrategy = new CompoundingStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(oethVault)
            }),
            address(mockWeth),
            address(mockSsvNetwork),
            address(mockDepositContract),
            address(mockBeaconProofs),
            BEACON_GENESIS_TIMESTAMP
        );

        // Set governor via storage slot (constructor sets it to address(0))
        vm.store(address(compoundingStakingSSVStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize and configure
        vm.startPrank(governor);

        address[] memory emptyAddresses = new address[](0);
        compoundingStakingSSVStrategy.initialize(emptyAddresses, emptyAddresses, emptyAddresses);
        oethVault.approveStrategy(address(compoundingStakingSSVStrategy));
        compoundingStakingSSVStrategy.setRegistrator(governor);
        compoundingStakingSSVStrategy.setHarvesterAddress(nick);

        vm.stopPrank();
    }

    function _labelContracts() internal {
        vm.label(address(nativeStakingSSVStrategy2), "NativeStakingSSVStrategy2");
        vm.label(address(nativeStakingSSVStrategy3), "NativeStakingSSVStrategy3");
        vm.label(address(compoundingStakingSSVStrategy), "CompoundingStakingSSVStrategy");
        vm.label(address(consolidationController), "ConsolidationController");
        vm.label(address(nativeStakingFeeAccumulator2), "FeeAccumulator2");
        vm.label(address(nativeStakingFeeAccumulator3), "FeeAccumulator3");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(mockSsvNetwork), "MockSSVNetwork");
        vm.label(address(mockSsv), "MockSSV");
        vm.label(address(mockDepositContract), "MockDepositContract");
        vm.label(address(mockBeaconProofs), "MockBeaconProofs");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02, "BeaconRoots");
        vm.label(0x00000961Ef480Eb55e80D19ad83579A64c007002, "WithdrawalRequest");
        vm.label(0x0000BBdDc7CE488642fb579F8B00f3a590007251, "ConsolidationRequest");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Hash a public key using beacon chain format (sha256(pubkey ++ bytes16(0)))
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /// @dev Get an empty cluster struct
    function _emptyCluster() internal pure returns (Cluster memory) {
        return Cluster({validatorCount: 0, networkFeeIndex: 0, index: 0, active: true, balance: 0});
    }

    /// @dev Get operator IDs as dynamic array
    function _operatorIds() internal view returns (uint64[] memory) {
        uint64[] memory ids = new uint64[](4);
        ids[0] = testOperatorIds[0];
        ids[1] = testOperatorIds[1];
        ids[2] = testOperatorIds[2];
        ids[3] = testOperatorIds[3];
        return ids;
    }

    /// @dev Register and stake a validator on the given NativeStakingSSVStrategy
    /// to set it to STAKED state. Called before the registrator is set to ConsolidationController.
    function _registerAndStakeOnNative(NativeStakingSSVStrategy strategy, bytes memory pubKey) internal {
        // Temporarily set registrator back to governor for registration
        address currentRegistrator = strategy.validatorRegistrator();
        vm.prank(governor);
        strategy.setRegistrator(governor);

        // Reset staking tally to allow staking
        vm.prank(matt); // matt is the staking monitor
        strategy.resetStakeETHTally();

        // Register
        bytes[] memory pubKeys = new bytes[](1);
        pubKeys[0] = pubKey;
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;

        vm.prank(governor);
        strategy.registerSsvValidators(pubKeys, _operatorIds(), sharesData, _emptyCluster());

        // Fund strategy with WETH and stake
        deal(address(mockWeth), address(strategy), 32 ether);
        vm.prank(address(oethVault));
        strategy.deposit(address(mockWeth), 32 ether);

        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] =
            ValidatorStakeData({pubkey: pubKey, signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT});

        vm.prank(governor);
        strategy.stakeEth(stakeData);

        // Set activeDepositedValidators
        uint256 currentValidators = strategy.activeDepositedValidators();
        vm.store(address(strategy), bytes32(ACTIVE_DEPOSITED_VALIDATORS_SLOT), bytes32(currentValidators + 1));

        // Restore original registrator
        vm.prank(governor);
        strategy.setRegistrator(currentRegistrator);
    }

    /// @dev Register, stake, and fully activate a validator on the CompoundingStakingSSVStrategy
    /// so it reaches ACTIVE state (required for consolidation target)
    function _activateCompoundingValidator(bytes memory pubKey) internal {
        // Temporarily set registrator back to governor
        address currentRegistrator = compoundingStakingSSVStrategy.validatorRegistrator();
        vm.prank(governor);
        compoundingStakingSSVStrategy.setRegistrator(governor);

        bytes32 pubKeyHash = _hashPubKey(pubKey);

        // Register validator on SSV
        vm.prank(governor);
        compoundingStakingSSVStrategy.registerSsvValidator(pubKey, _operatorIds(), TEST_SHARES_DATA, _emptyCluster());

        // First deposit (1 ETH), verify validator, verify deposit
        _compoundingFirstDeposit(pubKey, pubKeyHash);

        // Second deposit (32 ETH) and verify
        _compoundingSecondDeposit(pubKey);

        // Snap and verify balances to finalize to ACTIVE state
        _compoundingSnapAndVerify(pubKeyHash);

        // Restore original registrator
        vm.prank(governor);
        compoundingStakingSSVStrategy.setRegistrator(currentRegistrator);
    }

    /// @dev First deposit + verify validator + verify deposit on compounding strategy
    function _compoundingFirstDeposit(bytes memory pubKey, bytes32 pubKeyHash) internal {
        deal(address(mockWeth), address(compoundingStakingSSVStrategy), 1 ether);
        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.deposit(address(mockWeth), 1 ether);

        _compoundingStakeEth(pubKey, uint64(1 ether / 1 gwei));

        // Verify validator (mock always passes)
        bytes32 withdrawalCredentials =
            bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), address(compoundingStakingSSVStrategy)));
        compoundingStakingSSVStrategy.verifyValidator(
            uint64(block.timestamp), 100, pubKeyHash, withdrawalCredentials, hex"00"
        );

        _compoundingVerifyLastDeposit();
    }

    /// @dev Second deposit + verify deposit on compounding strategy
    function _compoundingSecondDeposit(bytes memory pubKey) internal {
        deal(address(mockWeth), address(compoundingStakingSSVStrategy), 32 ether);
        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.deposit(address(mockWeth), 32 ether);

        _compoundingStakeEth(pubKey, uint64(32 ether / 1 gwei));
        _compoundingVerifyLastDeposit();
    }

    /// @dev Stake ETH to compounding strategy
    function _compoundingStakeEth(bytes memory pubKey, uint64 amountGwei) internal {
        CompoundingValidatorManager.ValidatorStakeData memory stakeData = CompoundingValidatorManager.ValidatorStakeData({
            pubkey: pubKey, signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });
        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, amountGwei);
    }

    /// @dev Verify the last deposit on the compounding strategy (mock always passes with empty queue)
    function _compoundingVerifyLastDeposit() internal {
        uint256 listLen = compoundingStakingSSVStrategy.depositListLength();
        bytes32 pendingDepositRoot = compoundingStakingSSVStrategy.depositList(listLen - 1);

        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);

        // Empty deposit queue proof (37 * 32 = 1184 bytes)
        bytes memory emptyQueueProof = new bytes(1184);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"
            });

        compoundingStakingSSVStrategy.verifyDeposit(
            pendingDepositRoot, depositSlot + 10_000, firstPending, strategyValidator
        );
    }

    /// @dev Snap balances and verify to finalize validator to ACTIVE state
    function _compoundingSnapAndVerify(bytes32 pubKeyHash) internal {
        vm.warp(block.timestamp + SNAP_BALANCES_DELAY + 1);
        vm.prank(governor);
        compoundingStakingSSVStrategy.snapBalances();

        uint256 verifiedCount = compoundingStakingSSVStrategy.verifiedValidatorsLength();
        uint256 depositCount = compoundingStakingSSVStrategy.depositListLength();

        vm.prank(governor);
        compoundingStakingSSVStrategy.verifyBalances(
            _emptyBalanceProofs(verifiedCount), _emptyPendingDepositProofs(depositCount)
        );

        // Confirm the validator is ACTIVE
        (CompoundingValidatorManager.ValidatorState state,) = compoundingStakingSSVStrategy.validator(pubKeyHash);
        require(state == CompoundingValidatorManager.ValidatorState.ACTIVE, "Target not ACTIVE");
    }

    /// @dev Empty balance proofs for verifyBalances
    function _emptyBalanceProofs(uint256 validatorCount)
        internal
        pure
        returns (CompoundingValidatorManager.BalanceProofs memory)
    {
        bytes32[] memory leaves = new bytes32[](validatorCount);
        bytes[] memory proofs = new bytes[](validatorCount);
        for (uint256 i = 0; i < validatorCount; i++) {
            leaves[i] = bytes32(0);
            proofs[i] = hex"00";
        }
        return CompoundingValidatorManager.BalanceProofs({
            balancesContainerRoot: bytes32(0),
            balancesContainerProof: hex"00",
            validatorBalanceLeaves: leaves,
            validatorBalanceProofs: proofs
        });
    }

    /// @dev Empty pending deposit proofs for verifyBalances
    function _emptyPendingDepositProofs(uint256 depositCount)
        internal
        pure
        returns (CompoundingValidatorManager.PendingDepositProofs memory)
    {
        uint32[] memory indexes = new uint32[](depositCount);
        bytes[] memory proofs = new bytes[](depositCount);
        for (uint256 i = 0; i < depositCount; i++) {
            indexes[i] = uint32(i);
            proofs[i] = hex"00";
        }
        return CompoundingValidatorManager.PendingDepositProofs({
            pendingDepositContainerRoot: bytes32(0),
            pendingDepositContainerProof: hex"00",
            pendingDepositIndexes: indexes,
            pendingDepositProofs: proofs
        });
    }

    /// @dev Activate target validator + register/stake source validators
    /// This is the common setup for tests that need consolidation to be possible.
    function _setupForConsolidation() internal {
        // Activate a validator on the compounding strategy
        _activateCompoundingValidator(TARGET_PUB_KEY);

        // Register and stake source validators on strategy 2
        _registerAndStakeOnNative(nativeStakingSSVStrategy2, TEST_PUB_KEY_1);
        _registerAndStakeOnNative(nativeStakingSSVStrategy2, TEST_PUB_KEY_2);
        _registerAndStakeOnNative(nativeStakingSSVStrategy2, TEST_PUB_KEY_3);

        // Register and stake a source validator on strategy 3
        _registerAndStakeOnNative(nativeStakingSSVStrategy3, TEST_PUB_KEY_1);
    }

    /// @dev Request consolidation as guardian (owner of ConsolidationController)
    function _requestConsolidation(address sourceStrategy, bytes[] memory sourcePubKeys, bytes memory targetPubKey)
        internal
    {
        vm.prank(guardian);
        consolidationController.requestConsolidation{value: CONSOLIDATION_FEE * sourcePubKeys.length}(
            sourceStrategy, sourcePubKeys, targetPubKey
        );
    }

    /// @dev Advance time past the minimum consolidation period
    function _advancePastConsolidationPeriod() internal {
        vm.warp(block.timestamp + MIN_CONSOLIDATION_PERIOD + 1);
    }

    /// @dev Allow test contract to receive ETH
    receive() external payable {}
}
