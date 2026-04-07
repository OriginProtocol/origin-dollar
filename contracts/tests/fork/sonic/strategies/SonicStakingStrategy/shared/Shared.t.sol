// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {ISFC} from "contracts/interfaces/sonic/ISFC.sol";
import {IWrappedSonic} from "contracts/interfaces/sonic/IWrappedSonic.sol";
import {ISonicStakingStrategy} from "contracts/interfaces/strategies/ISonicStakingStrategy.sol";

abstract contract Fork_SonicStakingStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    uint256 internal constant MIN_WITHDRAWAL_EPOCH_ADVANCE = 4;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    ISonicStakingStrategy internal sonicStakingStrategy;
    IOToken internal oSonic;
    IVault internal oSonicVault;
    ISFC internal sfc;
    IWrappedSonic internal wrappedSonic;
    address internal validatorRegistrator;
    address internal timelockAddr;
    uint256[] internal testValidatorIds;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkSonic();
        _loadForkContracts();
        _fundTestAccounts();
        _configureStrategy();
        _labelContracts();
    }

    function _loadForkContracts() internal {
        sonicStakingStrategy = ISonicStakingStrategy(Sonic.SonicStakingStrategy);
        oSonic = IOToken(Sonic.OSonicProxy);
        oSonicVault = IVault(Sonic.OSonicVaultProxy);
        sfc = ISFC(Sonic.SFC);
        wrappedSonic = IWrappedSonic(Sonic.wS);
    }

    function _fundTestAccounts() internal {
        vm.deal(clement, 500_000 ether);
        vm.prank(clement);
        wrappedSonic.deposit{value: 500_000 ether}();
    }

    function _configureStrategy() internal {
        // Override test actors with on-chain values
        strategist = IVault(address(oSonicVault)).strategistAddr();
        validatorRegistrator = sonicStakingStrategy.validatorRegistrator();
        timelockAddr = Sonic.timelock;

        // Set default validator to 18
        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(18);

        // Populate testValidatorIds
        testValidatorIds = new uint256[](5);
        testValidatorIds[0] = 15;
        testValidatorIds[1] = 16;
        testValidatorIds[2] = 17;
        testValidatorIds[3] = 18;
        testValidatorIds[4] = 45;
    }

    function _labelContracts() internal {
        vm.label(address(sonicStakingStrategy), "SonicStakingStrategy");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
        vm.label(address(sfc), "SFC");
        vm.label(address(wrappedSonic), "WrappedSonic");
        vm.label(Sonic.nodeDriveAuth, "NodeDriveAuth");
        vm.label(validatorRegistrator, "ValidatorRegistrator");
        vm.label(timelockAddr, "Timelock");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Transfer wS to strategy and call deposit or depositAll as vault
    function _depositTokenAmount(uint256 amount, bool useDepositAll) internal {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();
        uint256 strategyBalanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        uint256 wsBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(sonicStakingStrategy));

        // Transfer wS to strategy
        vm.prank(clement);
        IERC20(address(wrappedSonic)).transfer(address(sonicStakingStrategy), amount);

        // Call deposit as vault
        vm.startPrank(address(oSonicVault));
        if (useDepositAll) {
            vm.expectEmit(true, true, true, true, address(sonicStakingStrategy));
            emit ISonicStakingStrategy.Delegated(defaultValidatorId, amount);
            sonicStakingStrategy.depositAll();
        } else {
            vm.expectEmit(true, true, true, true, address(sonicStakingStrategy));
            emit ISonicStakingStrategy.Delegated(defaultValidatorId, amount);
            sonicStakingStrategy.deposit(address(wrappedSonic), amount);
        }
        vm.stopPrank();

        assertEq(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            strategyBalanceBefore + amount,
            "strategy checkBalance not increased"
        );
        assertEq(
            IERC20(address(wrappedSonic)).balanceOf(address(sonicStakingStrategy)),
            wsBalanceBefore,
            "Unexpected wS amount on strategy"
        );
    }

    /// @dev Transfer wS to strategy, then withdraw/withdrawAll as vault
    function _withdrawUndelegatedAmount(uint256 amount, bool useWithdrawAll) internal {
        uint256 strategyBalanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        uint256 wsBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(sonicStakingStrategy));

        // Transfer wS to strategy
        vm.prank(clement);
        IERC20(address(wrappedSonic)).transfer(address(sonicStakingStrategy), amount);

        vm.startPrank(address(oSonicVault));
        if (useWithdrawAll) {
            sonicStakingStrategy.withdrawAll();
        } else {
            sonicStakingStrategy.withdraw(address(oSonicVault), address(wrappedSonic), amount);
        }
        vm.stopPrank();

        assertEq(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            strategyBalanceBefore,
            "strategy checkBalance changed"
        );
        assertEq(
            IERC20(address(wrappedSonic)).balanceOf(address(sonicStakingStrategy)),
            wsBalanceBefore,
            "Unexpected wS amount on strategy"
        );
    }

    /// @dev Undelegate tokens from SFC as registrator
    function _undelegateTokenAmount(uint256 amount, uint256 validatorId) internal returns (uint256 withdrawId) {
        uint256 contractBalanceBefore = sonicStakingStrategy.checkBalance(address(wrappedSonic));
        uint256 expectedWithdrawId = sonicStakingStrategy.nextWithdrawId();
        uint256 pendingWithdrawalsBefore = sonicStakingStrategy.pendingWithdrawals();

        vm.expectEmit(true, true, true, true, address(sonicStakingStrategy));
        emit ISonicStakingStrategy.Undelegated(expectedWithdrawId, validatorId, amount);

        vm.prank(validatorRegistrator);
        withdrawId = sonicStakingStrategy.undelegate(validatorId, amount);

        (uint256 wdValidatorId, uint256 wdAmount,) = sonicStakingStrategy.withdrawals(expectedWithdrawId);
        assertEq(wdValidatorId, validatorId, "withdrawal validatorId mismatch");
        assertEq(wdAmount, amount, "withdrawal amount mismatch");
        assertEq(sonicStakingStrategy.pendingWithdrawals(), pendingWithdrawalsBefore + amount, "pending mismatch");
        assertEq(
            sonicStakingStrategy.checkBalance(address(wrappedSonic)),
            contractBalanceBefore,
            "Strategy checkBalance changed after undelegate"
        );
    }

    /// @dev Advance time + epochs, then withdraw from SFC
    function _withdrawFromSFC(uint256 withdrawalId, uint256 amountToWithdraw) internal {
        _advanceWeek();
        _advanceWeek();
        _advanceSfcEpoch(MIN_WITHDRAWAL_EPOCH_ADVANCE);

        uint256 vaultBalanceBefore = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        uint256 pendingWithdrawalsBefore = sonicStakingStrategy.pendingWithdrawals();

        (uint256 wdValidatorId,,) = sonicStakingStrategy.withdrawals(withdrawalId);

        vm.expectEmit(true, true, false, false, address(sonicStakingStrategy));
        emit ISonicStakingStrategy.Withdrawn(withdrawalId, wdValidatorId, 0, 0);

        vm.prank(validatorRegistrator);
        uint256 withdrawnAmount = sonicStakingStrategy.withdrawFromSFC(withdrawalId);

        // Withdrawn amount should be approximately the undelegated amount
        assertApproxEqAbs(withdrawnAmount, amountToWithdraw, 1, "withdrawn amount mismatch");

        // Vault wS balance should increase
        uint256 vaultBalanceAfter = IERC20(address(wrappedSonic)).balanceOf(address(oSonicVault));
        assertApproxEqAbs(vaultBalanceAfter, vaultBalanceBefore + amountToWithdraw, 1, "vault balance mismatch");

        // Pending withdrawals should decrease
        assertEq(
            sonicStakingStrategy.pendingWithdrawals(),
            pendingWithdrawalsBefore - amountToWithdraw,
            "pending withdrawals not reduced"
        );

        // Withdrawal struct should be zeroed
        (, uint256 wdAmount,) = sonicStakingStrategy.withdrawals(withdrawalId);
        assertEq(wdAmount, 0, "withdrawal not zeroed");
    }

    /// @dev Advance SFC epochs by sealing them
    function _advanceSfcEpoch(uint256 epochsToAdvance) internal {
        uint256 currentSealedEpoch = sfc.currentSealedEpoch();
        uint256[] memory epochValidators = sfc.getEpochValidatorIDs(currentSealedEpoch);
        uint256 validatorsLength = epochValidators.length;

        for (uint256 i = 0; i < epochsToAdvance; i++) {
            uint256[] memory offlineTimes = new uint256[](validatorsLength);
            uint256[] memory offlineBlocks = new uint256[](validatorsLength);
            uint256[] memory uptimes = new uint256[](validatorsLength);
            uint256[] memory originatedTxsFee = new uint256[](validatorsLength);

            for (uint256 j = 0; j < validatorsLength; j++) {
                // offlineTimes[j] = 0; (default)
                // offlineBlocks[j] = 0; (default)
                uptimes[j] = 600;
                originatedTxsFee[j] = 2955644249909388016706;
            }

            vm.warp(block.timestamp + 10 minutes);

            vm.startPrank(Sonic.nodeDriveAuth);
            sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFee);
            sfc.sealEpochValidators(epochValidators);
            vm.stopPrank();
        }
    }

    /// @dev Advance time by 1 week
    function _advanceWeek() internal {
        vm.warp(block.timestamp + 7 days);
    }

    /// @dev Slash the default validator
    function _slashValidator(uint256 slashingRefundRatio) internal {
        uint256 defaultValidatorId = sonicStakingStrategy.defaultValidatorId();

        vm.prank(Sonic.nodeDriveAuth);
        sfc.deactivateValidator(defaultValidatorId, 128);
        assertTrue(sfc.isSlashed(defaultValidatorId), "Not slashed");

        address sfcOwner = sfc.owner();
        vm.prank(sfcOwner);
        sfc.updateSlashingRefundRatio(defaultValidatorId, slashingRefundRatio);
        assertEq(sfc.slashingRefundRatio(defaultValidatorId), slashingRefundRatio, "slashingRefundRatio mismatch");
    }

    /// @dev Change the default validator
    function _changeDefaultValidator(uint256 validatorId) internal {
        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(validatorId);
    }
}
