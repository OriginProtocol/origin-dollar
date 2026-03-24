// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockSSVNetwork} from "contracts/mocks/MockSSVNetwork.sol";
import {MockSSV} from "contracts/mocks/MockSSV.sol";
import {MockDepositContract} from "contracts/mocks/MockDepositContract.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {NativeStakingSSVStrategy} from "contracts/strategies/NativeStaking/NativeStakingSSVStrategy.sol";
import {ValidatorStakeData} from "contracts/strategies/NativeStaking/ValidatorRegistrator.sol";
import {FeeAccumulator} from "contracts/strategies/NativeStaking/FeeAccumulator.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";

abstract contract Unit_NativeStakingSSVStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES (moved from Base)
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    MockSSVNetwork internal mockSsvNetwork;
    MockSSV internal mockSsv;
    MockDepositContract internal mockDepositContract;
    OETH internal oeth;
    OETHVault internal oethVault;
    OETHProxy internal oethProxy;
    OETHVaultProxy internal oethVaultProxy;
    NativeStakingSSVStrategy internal nativeStakingSSVStrategy;
    FeeAccumulator internal nativeStakingFeeAccumulator;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // Storage slots
    uint256 internal constant ACTIVE_DEPOSITED_VALIDATORS_SLOT = 52;
    uint256 internal constant CONSENSUS_REWARDS_SLOT = 104;

    uint256 internal constant MIN_FIX_ACCOUNTING_CADENCE = 7200;

    // Test validator data
    bytes internal constant TEST_PUBLIC_KEY =
        hex"aba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25";
    bytes internal constant TEST_SIGNATURE =
        hex"90157a1c1b26384f0b4d41bec867d1a000f75e7b634ac7c4c6d8dfc0b0eaeb73bcc99586333d42df98c6b0a8c5ef0d8d071c68991afcd8fbbaa8b423e3632ee4fe0782bc03178a30a8bc6261f64f84a6c833fb96a0f29de1c34ede42c4a859b0";
    bytes32 internal constant TEST_DEPOSIT_DATA_ROOT =
        0xdbe778a625c68446f3cc8b2009753a5e7dd7c37b8721ee98a796bb9179dfe8ac;
    bytes internal constant TEST_SHARES_DATA =
        hex"859f01c8f609cb5cb91f0c98e9b39b077775f10302d0db0edc4ea65e692c97920d5169f6281845a956404c0ba90b8806";

    bytes[6] internal testPublicKeys;
    uint64[4] internal testOperatorIds = [uint64(348), uint64(352), uint64(361), uint64(377)];

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _initTestPublicKeys();
        _deployContracts();
        _labelContracts();
    }

    function _initTestPublicKeys() internal {
        testPublicKeys[0] =
        hex"aba6acd335d524a89fb89b9977584afdb23f34a6742547fa9ec1c656fbd2bfc0e7a234460328c2731828c9a43be06e25";
        testPublicKeys[1] =
        hex"a8adaec39a6738b09053a3ed9d44e481d5b2dfafefe0059da48756db951adf4f2956c1149f3bd0634e4cde009a770afb";
        testPublicKeys[2] =
        hex"aa8cdeb9efe0cb2f703332a46051214464796e7de7b882abd243c175b2d96250ad227846f713876445f864b2e2f695c1";
        testPublicKeys[3] =
        hex"b22b68e2a4f524e96c7818dbfca3de0f7fb4e87449fe8166fd310bea3e3e4295db41b21e65612d1d4bd8a14f2d47e49a";
        testPublicKeys[4] =
        hex"92fe1f554b8110fa5c74af8181ca2afaad12f6d22cad933ef1978b5d4d099d75045e4d6d15066c290aee29990858cb90";
        testPublicKeys[5] =
        hex"b27b34f6931ba70a11c2ba82f194e9b98093a5a482bb035a836df9aa4b5f57542354da453538b651c18eefc0ea3a7689";
    }

    function _deployContracts() internal {
        // Deploy mocks
        mockWeth = new MockWETH();
        mockSsvNetwork = new MockSSVNetwork();
        mockSsv = new MockSSV();
        mockDepositContract = new MockDepositContract();

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

        // Predict strategy address for FeeAccumulator circular dependency
        uint64 nonce = vm.getNonce(address(this));
        address predictedStrategy = vm.computeCreateAddress(address(this), nonce + 1);

        // Deploy FeeAccumulator first with predicted strategy address
        nativeStakingFeeAccumulator = new FeeAccumulator(predictedStrategy);

        // Deploy NativeStakingSSVStrategy
        nativeStakingSSVStrategy = new NativeStakingSSVStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(0), vaultAddress: address(oethVault)
            }),
            address(mockWeth),
            address(mockSsv),
            address(mockSsvNetwork),
            256,
            address(nativeStakingFeeAccumulator),
            address(mockDepositContract)
        );

        // Verify FeeAccumulator points to the correct strategy
        assertEq(nativeStakingFeeAccumulator.STRATEGY(), address(nativeStakingSSVStrategy));

        // Set governor via storage slot
        vm.store(address(nativeStakingSSVStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize and configure
        vm.startPrank(governor);

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(mockWeth);
        address[] memory emptyAddresses = new address[](0);

        nativeStakingSSVStrategy.initialize(rewardTokens, emptyAddresses, emptyAddresses);
        oethVault.approveStrategy(address(nativeStakingSSVStrategy));

        // Registrator = governor (matches Hardhat fixture)
        nativeStakingSSVStrategy.setRegistrator(governor);
        nativeStakingSSVStrategy.setFuseInterval(21.6 ether, 25.6 ether);
        nativeStakingSSVStrategy.setStakingMonitor(matt);
        nativeStakingSSVStrategy.setStakeETHThreshold(64 ether);
        nativeStakingSSVStrategy.setHarvesterAddress(nick);

        vm.stopPrank();

        // Assign weth
        weth = IERC20(address(mockWeth));

        // Fund josh with WETH by depositing ETH (ensures totalSupply is correct)
        vm.deal(josh, 10_000 ether);
        vm.prank(josh);
        mockWeth.deposit{value: 10_000 ether}();
    }

    function _labelContracts() internal {
        vm.label(address(nativeStakingSSVStrategy), "NativeStakingSSVStrategy");
        vm.label(address(nativeStakingFeeAccumulator), "FeeAccumulator");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(mockSsvNetwork), "MockSSVNetwork");
        vm.label(address(mockSsv), "MockSSV");
        vm.label(address(mockDepositContract), "MockDepositContract");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Set activeDepositedValidators via storage slot
    function _setActiveDepositedValidators(uint256 _validators) internal {
        vm.store(address(nativeStakingSSVStrategy), bytes32(ACTIVE_DEPOSITED_VALIDATORS_SLOT), bytes32(_validators));
        assertEq(nativeStakingSSVStrategy.activeDepositedValidators(), _validators);
    }

    /// @dev Set consensusRewards via storage slot
    function _setConsensusRewards(uint256 _rewards) internal {
        vm.store(address(nativeStakingSSVStrategy), bytes32(CONSENSUS_REWARDS_SLOT), bytes32(_rewards));
        assertEq(nativeStakingSSVStrategy.consensusRewards(), _rewards);
    }

    /// @dev Mint WETH to strategy and call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(address(mockWeth), address(nativeStakingSSVStrategy), amount);
        vm.prank(address(oethVault));
        nativeStakingSSVStrategy.deposit(address(mockWeth), amount);
    }

    /// @dev Get an empty cluster struct
    function _emptyCluster() internal pure returns (Cluster memory) {
        return Cluster({validatorCount: 0, networkFeeIndex: 0, index: 0, active: true, balance: 0});
    }

    /// @dev Register a single validator
    function _registerValidator(uint256 index) internal {
        bytes[] memory pubKeys = new bytes[](1);
        pubKeys[0] = testPublicKeys[index];
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;
        uint64[] memory operatorIds = new uint64[](4);
        operatorIds[0] = testOperatorIds[0];
        operatorIds[1] = testOperatorIds[1];
        operatorIds[2] = testOperatorIds[2];
        operatorIds[3] = testOperatorIds[3];

        vm.prank(governor);
        nativeStakingSSVStrategy.registerSsvValidators(pubKeys, operatorIds, sharesData, _emptyCluster());
    }

    /// @dev Register and stake a single validator
    function _registerAndStakeValidator(uint256 index) internal {
        _registerValidator(index);

        // Build stake data
        ValidatorStakeData[] memory stakeData = new ValidatorStakeData[](1);
        stakeData[0] = ValidatorStakeData({
            pubkey: testPublicKeys[index], signature: TEST_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(governor);
        nativeStakingSSVStrategy.stakeEth(stakeData);
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

    /// @dev Allow test contract to receive ETH
    receive() external payable {}
}
