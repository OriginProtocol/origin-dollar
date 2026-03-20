// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_CheckBalance_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_checkBalance_includesWSBalance() public {
        // Deal wS directly to strategy (not deposited to pool)
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), 5 ether);

        uint256 balance = sonicSwapXAMOStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, 5 ether);
    }

    function test_checkBalance_includesLPValue() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Should include LP value from gauge
        uint256 balance = sonicSwapXAMOStrategy.checkBalance(address(mockWrappedSonic));
        assertGt(balance, 0);
    }

    function test_checkBalance_zeroLPCase() public view {
        // No deposit, no direct balance
        uint256 balance = sonicSwapXAMOStrategy.checkBalance(address(mockWrappedSonic));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_wrongAsset() public {
        vm.expectRevert("Unsupported asset");
        sonicSwapXAMOStrategy.checkBalance(address(oSonic));
    }

    function test_checkBalance_returnsWSOnlyWhenPoolTotalSupplyIsZero() public {
        _seedVaultForSolvency(100 ether);
        _depositAsVault(10 ether);

        // Deal wS directly to strategy
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), 3 ether);

        // Mock pool totalSupply to return 0 (edge case: _lpValue early return)
        vm.mockCall(
            address(mockSwapXPair), abi.encodeWithSelector(mockSwapXPair.totalSupply.selector), abi.encode(uint256(0))
        );

        uint256 balance = sonicSwapXAMOStrategy.checkBalance(address(mockWrappedSonic));
        // _lpValue returns 0 when totalSupply is 0, so balance is only wS in strategy
        assertEq(balance, 3 ether);
    }
}
