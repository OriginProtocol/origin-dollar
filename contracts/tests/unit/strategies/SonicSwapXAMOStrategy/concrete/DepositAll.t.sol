// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_DepositAll_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_depositAll_depositsAll() public {
        uint256 amount = 10 ether;
        _seedVaultForSolvency(100 ether);
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), amount);

        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.depositAll();

        // All wS should be deposited
        assertEq(IERC20(address(mockWrappedSonic)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
        // LP tokens should be in gauge
        assertGt(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_depositAll_noOpOnZero() public {
        // No wS in strategy - should not revert
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.depositAll();

        assertEq(mockSwapXGauge.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_depositAll_RevertWhen_calledByNonVault() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault");
        sonicSwapXAMOStrategy.depositAll();
    }
}
