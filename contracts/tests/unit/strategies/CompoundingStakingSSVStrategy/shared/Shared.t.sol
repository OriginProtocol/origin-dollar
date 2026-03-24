// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockSSVNetwork} from "contracts/mocks/MockSSVNetwork.sol";
import {MockSSV} from "contracts/mocks/MockSSV.sol";
import {MockDepositContract} from "contracts/mocks/MockDepositContract.sol";
import {MockBeaconProofs} from "contracts/mocks/beacon/MockBeaconProofs.sol";
import {MockBeaconRoots} from "tests/mocks/MockBeaconRoots.sol";
import {MockWithdrawalRequest} from "tests/mocks/MockWithdrawalRequest.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {CompoundingStakingSSVStrategy} from "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol";
import {CompoundingValidatorManager} from "contracts/strategies/NativeStaking/CompoundingValidatorManager.sol";
import {CompoundingStakingStrategyView} from "contracts/strategies/NativeStaking/CompoundingStakingView.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {Cluster} from "contracts/interfaces/ISSVNetwork.sol";

abstract contract Unit_CompoundingStakingSSVStrategy_Shared_Test is Base {
    using stdJson for string;

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
    CompoundingStakingSSVStrategy internal compoundingStakingSSVStrategy;
    CompoundingStakingStrategyView internal compoundingStakingView;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // Beacon chain constants
    uint64 internal constant BEACON_GENESIS_TIMESTAMP = 1_600_000_000;
    uint64 internal constant SLOT_DURATION = 12;
    uint64 internal constant SLOTS_PER_EPOCH = 32;

    // Path to JSON test data (relative to project root)
    string internal constant VALIDATORS_JSON_PATH = "test/strategies/compoundingSSVStaking-validatorsData.json";

    //////////////////////////////////////////////////////
    /// --- VALIDATOR DATA (loaded from JSON)
    //////////////////////////////////////////////////////

    /// @dev Parsed validator data from JSON
    struct TestValidator {
        bytes publicKey;
        bytes32 publicKeyHash;
        uint256 index;
        uint64[] operatorIds;
        bytes sharesData;
        bytes signature;
        bytes32 depositDataRoot;
    }

    TestValidator[] internal testValidators;

    // Mock contracts for precompiles
    MockBeaconRoots internal mockBeaconRootsContract;
    MockWithdrawalRequest internal mockWithdrawalRequest;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        // Set block timestamp well after beacon genesis
        vm.warp(BEACON_GENESIS_TIMESTAMP + 1_000_000);

        _loadValidatorData();
        _deployContracts();
        _labelContracts();
    }

    function _loadValidatorData() internal {
        string memory json = vm.readFile(VALIDATORS_JSON_PATH);

        // Determine validator count by parsing the publicKey array length
        // Note: stdJson cannot handle float fields (e.g. depositAmount: 51.497526)
        // so we parse each field individually per validator, avoiding float paths.
        uint256 count = 21; // Known count from JSON file

        for (uint256 i = 0; i < count; i++) {
            string memory base = string.concat(".testValidators[", vm.toString(i), "]");

            bytes memory publicKey = abi.decode(json.parseRaw(string.concat(base, ".publicKey")), (bytes));
            bytes32 publicKeyHash = abi.decode(json.parseRaw(string.concat(base, ".publicKeyHash")), (bytes32));
            uint256 index = abi.decode(json.parseRaw(string.concat(base, ".index")), (uint256));
            uint64[] memory opIds = abi.decode(json.parseRaw(string.concat(base, ".operatorIds")), (uint64[]));
            bytes memory sharesData = abi.decode(json.parseRaw(string.concat(base, ".sharesData")), (bytes));
            bytes memory signature = abi.decode(json.parseRaw(string.concat(base, ".signature")), (bytes));
            bytes32 depositDataRoot =
                abi.decode(json.parseRaw(string.concat(base, ".depositProof.depositDataRoot")), (bytes32));

            testValidators.push(
                TestValidator({
                    publicKey: publicKey,
                    publicKeyHash: publicKeyHash,
                    index: index,
                    operatorIds: opIds,
                    sharesData: sharesData,
                    signature: signature,
                    depositDataRoot: depositDataRoot
                })
            );
        }
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
        mockWithdrawalRequest = new MockWithdrawalRequest();
        vm.etch(0x00000961Ef480Eb55e80D19ad83579A64c007002, address(mockWithdrawalRequest).code);
        mockWithdrawalRequest = MockWithdrawalRequest(payable(0x00000961Ef480Eb55e80D19ad83579A64c007002));

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

        // Deploy CompoundingStakingSSVStrategy
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

        // Deploy view contract
        compoundingStakingView = new CompoundingStakingStrategyView(address(compoundingStakingSSVStrategy));

        // Assign weth
        weth = IERC20(address(mockWeth));

        // Fund josh with WETH by depositing ETH (ensures totalSupply is correct)
        vm.deal(josh, 10_000 ether);
        vm.prank(josh);
        mockWeth.deposit{value: 10_000 ether}();
    }

    function _labelContracts() internal {
        vm.label(address(compoundingStakingSSVStrategy), "CompoundingStakingSSVStrategy");
        vm.label(address(compoundingStakingView), "CompoundingStakingView");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(mockSsvNetwork), "MockSSVNetwork");
        vm.label(address(mockSsv), "MockSSV");
        vm.label(address(mockDepositContract), "MockDepositContract");
        vm.label(address(mockBeaconProofs), "MockBeaconProofs");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(0x000F3df6D732807Ef1319fB7B8bB8522d0Beac02, "BeaconRoots");
        vm.label(0x00000961Ef480Eb55e80D19ad83579A64c007002, "WithdrawalRequest");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Get an empty cluster struct
    function _emptyCluster() internal pure returns (Cluster memory) {
        return Cluster({validatorCount: 0, networkFeeIndex: 0, index: 0, active: true, balance: 0});
    }

    /// @dev Get operator IDs for validator at index
    function _operatorIds(uint256 validatorIdx) internal view returns (uint64[] memory) {
        return testValidators[validatorIdx].operatorIds;
    }

    /// @dev Get operator IDs for first validator (convenience)
    function _operatorIds() internal view returns (uint64[] memory) {
        return _operatorIds(0);
    }

    /// @dev Hash a public key using beacon chain format
    function _hashPubKey(bytes memory pubKey) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(pubKey, bytes16(0)));
    }

    /// @dev Get withdrawal credentials for this strategy (0x02 type)
    function _withdrawalCredentials() internal view returns (bytes memory) {
        return abi.encodePacked(bytes1(0x02), bytes11(0), address(compoundingStakingSSVStrategy));
    }

    /// @dev Get withdrawal credentials as bytes32
    function _withdrawalCredentialsBytes32() internal view returns (bytes32) {
        return bytes32(abi.encodePacked(bytes1(0x02), bytes11(0), address(compoundingStakingSSVStrategy)));
    }

    /// @dev Calculate slot from timestamp
    function _calcSlot(uint256 timestamp) internal pure returns (uint64) {
        return uint64((timestamp - BEACON_GENESIS_TIMESTAMP) / SLOT_DURATION);
    }

    /// @dev Calculate next block timestamp from slot
    function _calcNextBlockTimestamp(uint64 slot) internal pure returns (uint64) {
        return SLOT_DURATION * slot + BEACON_GENESIS_TIMESTAMP + SLOT_DURATION;
    }

    /// @dev Transfer WETH from josh to strategy (simulating vault deposit)
    function _depositToStrategy(uint256 amount) internal {
        vm.prank(josh);
        weth.transfer(address(compoundingStakingSSVStrategy), amount);
        vm.prank(address(oethVault));
        compoundingStakingSSVStrategy.deposit(address(mockWeth), amount);
    }

    /// @dev Register a single validator on SSV using JSON data
    function _registerValidator(uint256 index) internal {
        TestValidator storage v = testValidators[index];
        vm.prank(governor);
        compoundingStakingSSVStrategy.registerSsvValidator(v.publicKey, v.operatorIds, v.sharesData, _emptyCluster());
    }

    /// @dev Stake 1 ETH to a registered validator (first deposit) using JSON data
    function _stakeFirstDeposit(uint256 index) internal returns (bytes32 pendingDepositRoot) {
        TestValidator storage v = testValidators[index];
        _depositToStrategy(1 ether);

        CompoundingValidatorManager.ValidatorStakeData memory stakeData = CompoundingValidatorManager.ValidatorStakeData({
            pubkey: v.publicKey, signature: v.signature, depositDataRoot: v.depositDataRoot
        });

        vm.prank(governor);
        compoundingStakingSSVStrategy.stakeEth(stakeData, uint64(1 ether / 1 gwei));

        // Get the pending deposit root
        uint256 listLen = compoundingStakingSSVStrategy.depositListLength();
        pendingDepositRoot = compoundingStakingSSVStrategy.depositList(listLen - 1);
    }

    /// @dev Register and stake first deposit
    function _registerAndStake(uint256 index) internal returns (bytes32 pendingDepositRoot) {
        _registerValidator(index);
        pendingDepositRoot = _stakeFirstDeposit(index);
    }

    /// @dev Verify a staked validator (mock - always passes)
    function _verifyValidator(uint256 index, uint40 validatorIndex) internal {
        TestValidator storage v = testValidators[index];
        bytes32 pubKeyHash = _hashPubKey(v.publicKey);
        uint64 nextBlockTimestamp = uint64(block.timestamp);

        compoundingStakingSSVStrategy.verifyValidator(
            nextBlockTimestamp, validatorIndex, pubKeyHash, _withdrawalCredentialsBytes32(), hex"00"
        );
    }

    /// @dev Verify a deposit as processed (mock - always passes with empty queue)
    function _verifyDeposit(bytes32 pendingDepositRoot) internal {
        (,, uint64 depositSlot,,) = compoundingStakingSSVStrategy.deposits(pendingDepositRoot);
        uint64 processedSlot = depositSlot + 10_000;

        // Empty deposit queue proof (37 * 32 = 1184 bytes)
        bytes memory emptyQueueProof = new bytes(1184);

        CompoundingValidatorManager.FirstPendingDepositSlotProofData memory firstPending =
            CompoundingValidatorManager.FirstPendingDepositSlotProofData({slot: 1, proof: emptyQueueProof});

        CompoundingValidatorManager.StrategyValidatorProofData memory strategyValidator =
            CompoundingValidatorManager.StrategyValidatorProofData({
                withdrawableEpoch: type(uint64).max, withdrawableEpochProof: hex"00"
            });

        compoundingStakingSSVStrategy.verifyDeposit(pendingDepositRoot, processedSlot, firstPending, strategyValidator);
    }

    /// @dev Full flow: register → stake → verify validator → verify deposit
    function _processValidator(uint256 index, uint40 validatorIndex) internal returns (bytes32 pendingDepositRoot) {
        pendingDepositRoot = _registerAndStake(index);
        _verifyValidator(index, validatorIndex);
        _verifyDeposit(pendingDepositRoot);
    }

    /// @dev Snap balances (calls snapBalances as registrator)
    function _snapBalances() internal returns (uint64 snapTimestamp) {
        snapTimestamp = uint64(block.timestamp);
        vm.prank(governor);
        compoundingStakingSSVStrategy.snapBalances();
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

    /// @dev Verify balances as registrator (governor)
    function _verifyBalances(
        CompoundingValidatorManager.BalanceProofs memory balanceProofs,
        CompoundingValidatorManager.PendingDepositProofs memory pendingDepositProofs
    ) internal {
        vm.prank(governor);
        compoundingStakingSSVStrategy.verifyBalances(balanceProofs, pendingDepositProofs);
    }

    /// @dev Allow test contract to receive ETH
    receive() external payable {}
}
