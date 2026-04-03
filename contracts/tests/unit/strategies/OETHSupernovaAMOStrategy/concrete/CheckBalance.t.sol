// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_CheckBalance_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_checkBalance_includesWETHBalance() public {
        // Deal WETH directly to strategy (not deposited to pool)
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), 5 ether);

        uint256 balance = oethSupernovaAMOStrategy.checkBalance(address(mockWeth));
        assertEq(balance, 5 ether);
    }

    function test_checkBalance_includesLPValue() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Should include LP value from gauge
        uint256 balance = oethSupernovaAMOStrategy.checkBalance(address(mockWeth));
        assertGt(balance, 0);
    }

    function test_checkBalance_zeroLPCase() public view {
        // No deposit, no direct balance
        uint256 balance = oethSupernovaAMOStrategy.checkBalance(address(mockWeth));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unsupported asset");
        oethSupernovaAMOStrategy.checkBalance(address(oeth));
    }

    function test_checkBalance_returnsWETHOnlyWhenPoolTotalSupplyIsZero() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Deal WETH directly to strategy
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), 3 ether);

        // Mock pool totalSupply to return 0 (edge case: _lpValue early return)
        vm.mockCall(
            address(mockSwapXPair), abi.encodeWithSelector(mockSwapXPair.totalSupply.selector), abi.encode(uint256(0))
        );

        uint256 balance = oethSupernovaAMOStrategy.checkBalance(address(mockWeth));
        // _lpValue returns 0 when totalSupply is 0, so balance is only WETH in strategy
        assertEq(balance, 3 ether);
    }
}
