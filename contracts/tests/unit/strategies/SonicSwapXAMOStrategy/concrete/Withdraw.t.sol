// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {ISonicSwapXAMOStrategy} from "contracts/interfaces/strategies/ISonicSwapXAMOStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Withdraw_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_withdraw_removesLPAndTransfersWS() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        uint256 vaultBalBefore = IERC20(address(mockWrappedSonic)).balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), withdrawAmount);

        assertEq(IERC20(address(mockWrappedSonic)).balanceOf(address(oSonicVault)) - vaultBalBefore, withdrawAmount);
    }

    function test_withdraw_burnsOS() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        uint256 supplyBefore = oSonic.totalSupply();

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), withdrawAmount);

        // OS should have been burned
        assertLt(oSonic.totalSupply(), supplyBefore);
    }

    function test_withdraw_emitsWithdrawalEvents() public {
        uint256 depositAmount = 10 ether;
        uint256 withdrawAmount = 5 ether;
        _seedVaultForSolvency(100 ether);
        _depositAsVault(depositAmount);

        vm.expectEmit(true, true, true, true);
        emit ISonicSwapXAMOStrategy.Withdrawal(address(mockWrappedSonic), address(mockSwapXPair), withdrawAmount);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), withdrawAmount);
    }

    function test_withdraw_RevertWhen_zeroAmount() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Must withdraw something");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 0);
    }

    function test_withdraw_RevertWhen_wrongAsset() public {
        vm.prank(address(oSonicVault));
        vm.expectRevert("Unsupported asset");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(oSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 1 ether);
    }

    function test_withdraw_RevertWhen_notWithdrawToVault() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Only withdraw to vault allowed");
        sonicSwapXAMOStrategy.withdraw(alice, address(mockWrappedSonic), 5 ether);
    }

    function test_withdraw_RevertWhen_insufficientLP() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(1 ether);

        // Try to withdraw far more than what's in the pool
        vm.prank(address(oSonicVault));
        vm.expectRevert("Not enough LP tokens in gauge");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 1_000_000 ether);
    }

    function test_withdraw_RevertWhen_protocolInsolvent() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Inflate supply to cause insolvency after withdraw
        vm.prank(address(oSonicVault));
        oSonic.mint(alice, 10_000 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 5 ether);
    }

    function test_withdraw_RevertWhen_emptyPoolReserves() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Zero out wS reserves (skim will transfer excess to strategy first)
        _setupPoolReserves(0, 100 ether);

        vm.prank(address(oSonicVault));
        vm.expectRevert("Empty pool");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 5 ether);
    }

    function test_withdraw_RevertWhen_notEnoughWSRemoved() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Mock pool burn to return nothing (simulating edge case where pool
        // returns less wS than expected)
        vm.mockCall(
            address(mockSwapXPair),
            abi.encodeWithSelector(bytes4(keccak256("burn(address)"))),
            abi.encode(uint256(0), uint256(0))
        );

        vm.prank(address(oSonicVault));
        vm.expectRevert("Not enough asset removed");
        sonicSwapXAMOStrategy.withdraw(address(oSonicVault), address(mockWrappedSonic), 5 ether);
    }
}
