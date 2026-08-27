// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IDepositContract} from "contracts/interfaces/IDepositContract.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {ICompoundingStakingStrategy} from "contracts/interfaces/strategies/ICompoundingStakingStrategy.sol";
import {
    CompoundingValidatorStakeData,
    CompoundingValidatorState
} from "contracts/interfaces/strategies/CompoundingStakingTypes.sol";

abstract contract Fork_CompoundingStakingStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint64 internal constant BEACON_GENESIS_TIMESTAMP = 1_606_824_023;
    uint256 internal constant INITIAL_DEPOSIT_AMOUNT = 32.25 ether;
    /// @dev snappedBalance.timestamp and snappedBalance.ethBalance are packed in storage slot 57.
    uint256 internal constant SNAPPED_BALANCE_DATA_SLOT = 57;

    /// @dev BLS-valid deposit data generated for the live strategy proxy's 0x02 withdrawal credentials,
    ///      a 32.25 ETH deposit, and the zero deposit domain fork version.
    bytes internal constant TEST_VALIDATOR_PUBKEY =
        hex"8ae7e5822ba97ab07877ea318e747499da648b27302414f9d0b9bb7e3646d248be90c9fdaddfdb93485a6e9334f01093";
    bytes internal constant TEST_VALIDATOR_SIGNATURE =
        hex"a1c8169389d71eef749cccdf1da5f248315ab4abf63b69c8d329cd31deb30f23c02e241e2036c7eee28d8cd3102ff5bb0e7cbade8799f5b2ae32f501e137c61e0697b6cb21114ec6b3e79d0d74550e0175855d85b0b0a54adc31814615ade316";
    bytes32 internal constant TEST_DEPOSIT_DATA_ROOT =
        0x4469ed6513fca79115a3937e37abdb68475118ae61fc2e1a7dbbeb8956511993;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ICompoundingStakingStrategy internal strategy;
    IProxy internal strategyProxy;
    IVault internal oethVault;
    IDepositContract internal beaconDepositContract;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal validatorRegistratorAddr;
    address internal strategistAddr;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _upgradeStrategy();
        _loadContracts();
        _prepareStrategy();
        _fundVault();
        _labelContracts();
    }

    function _upgradeStrategy() internal {
        strategyProxy = IProxy(Mainnet.CompoundingStakingStrategyProxy);

        address implementation = vm.deployCode(
            Strategies.COMPOUNDING_STAKING_STRATEGY,
            abi.encode(
                address(0),
                Mainnet.OETHVaultProxy,
                Mainnet.WETH,
                Mainnet.beaconChainDepositContract,
                Mainnet.BeaconProofs,
                BEACON_GENESIS_TIMESTAMP
            )
        );

        vm.prank(Mainnet.Timelock);
        strategyProxy.upgradeTo(implementation);
    }

    function _loadContracts() internal {
        strategy = ICompoundingStakingStrategy(Mainnet.CompoundingStakingStrategyProxy);
        oethVault = IVault(Mainnet.OETHVaultProxy);
        beaconDepositContract = IDepositContract(Mainnet.beaconChainDepositContract);
        weth = IERC20(Mainnet.WETH);

        validatorRegistratorAddr = strategy.validatorRegistrator();
        strategistAddr = oethVault.strategistAddr();

        require(validatorRegistratorAddr != address(0), "validator registrator not set");
        require(strategistAddr != address(0), "vault strategist not set");
    }

    function _prepareStrategy() internal {
        vm.startPrank(Mainnet.Timelock);
        strategy.setInitialDepositAmount(INITIAL_DEPOSIT_AMOUNT);
        if (strategy.firstDeposit()) strategy.resetFirstDeposit();
        if (strategy.paused()) strategy.unPause();
        vm.stopPrank();
    }

    function _fundVault() internal {
        deal(Mainnet.WETH, address(oethVault), weth.balanceOf(address(oethVault)) + 1_000_000 ether);
        deal(Mainnet.WETH, domen, 1_000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(strategy), "CompoundingStakingStrategy");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(weth), "WETH");
        vm.label(address(beaconDepositContract), "BeaconChainDepositContract");
        vm.label(validatorRegistratorAddr, "ValidatorRegistrator");
        vm.label(strategistAddr, "Strategist");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _depositToStrategy(uint256 amount) internal {
        address[] memory assets = new address[](1);
        assets[0] = address(weth);
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        vm.prank(strategistAddr);
        oethVault.depositToStrategy(address(strategy), assets, amounts);
    }

    function _stakeValidator() internal {
        bytes32 pubKeyHash = sha256(abi.encodePacked(TEST_VALIDATOR_PUBKEY, bytes16(0)));
        (CompoundingValidatorState stateBefore,) = strategy.validator(pubKeyHash);
        assertEq(
            uint256(stateBefore), uint256(CompoundingValidatorState.NON_REGISTERED), "validator already registered"
        );

        uint256 wethBalanceBefore = weth.balanceOf(address(strategy));
        uint256 strategyBalanceBefore = strategy.checkBalance(address(weth));
        uint256 depositContractBalanceBefore = address(beaconDepositContract).balance;
        bytes32 beaconDepositRootBefore = beaconDepositContract.get_deposit_root();
        uint256 depositListLengthBefore = strategy.depositListLength();

        CompoundingValidatorStakeData memory stakeData = CompoundingValidatorStakeData({
            pubkey: TEST_VALIDATOR_PUBKEY, signature: TEST_VALIDATOR_SIGNATURE, depositDataRoot: TEST_DEPOSIT_DATA_ROOT
        });

        vm.prank(validatorRegistratorAddr);
        vm.expectEmit(true, false, false, true, address(strategy));
        emit ICompoundingStakingStrategy.ETHStaked(
            pubKeyHash, bytes32(0), TEST_VALIDATOR_PUBKEY, INITIAL_DEPOSIT_AMOUNT
        );
        strategy.stakeEth(stakeData, uint64(INITIAL_DEPOSIT_AMOUNT / 1 gwei));

        (CompoundingValidatorState state,) = strategy.validator(pubKeyHash);
        assertEq(uint256(state), uint256(CompoundingValidatorState.STAKED), "validator not staked");
        assertTrue(strategy.firstDeposit(), "first deposit not tracked");
        assertEq(strategy.depositListLength(), depositListLengthBefore + 1, "pending deposit not added");
        assertEq(
            weth.balanceOf(address(strategy)), wethBalanceBefore - INITIAL_DEPOSIT_AMOUNT, "strategy WETH not staked"
        );
        assertEq(strategy.checkBalance(address(weth)), strategyBalanceBefore, "strategy balance changed on stake");
        assertEq(
            address(beaconDepositContract).balance,
            depositContractBalanceBefore + INITIAL_DEPOSIT_AMOUNT,
            "beacon deposit not funded"
        );
        assertNotEq(beaconDepositContract.get_deposit_root(), beaconDepositRootBefore, "beacon deposit root unchanged");
    }
}
