// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_CompoundingStakingSSVStrategy_Shared_Test
} from "tests/unit/strategies/CompoundingStakingSSVStrategy/shared/Shared.t.sol";

// --- Project imports
import {ICompoundingStakingSSVStrategy} from "contracts/interfaces/strategies/ICompoundingStakingSSVStrategy.sol";

contract Unit_Concrete_CompoundingStakingSSVStrategy_CheckBalance_Test is
    Unit_CompoundingStakingSSVStrategy_Shared_Test
{
    function test_checkBalance_zero() public view {
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 0);
    }

    function test_checkBalance_wethOnly() public {
        _depositToStrategy(5 ether);
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 5 ether);
    }

    function test_checkBalance_RevertWhen_unsupportedAsset() public {
        vm.expectRevert(ICompoundingStakingSSVStrategy.UnsupportedAsset.selector);
        compoundingStakingSSVStrategy.checkBalance(address(mockSsv));
    }

    function test_checkBalance_includesLastVerifiedBalance() public {
        // Deposit 5 ETH to strategy
        _depositToStrategy(5 ether);

        // _registerAndStake deposits an additional 1 ETH then stakes it
        // stakeEth calls _convertWethToEth(1 ETH) which:
        //   - WETH.withdraw(1 ETH): WETH balance 6→5
        //   - depositedWethAccountedFor: 6→5
        //   - lastVerifiedEthBalance: 0→1
        // Then 1 ETH is sent to deposit contract, strategy ETH balance = 0
        _registerAndStake(0);

        // checkBalance = lastVerifiedEthBalance(1) + WETH.balanceOf(5) = 6
        assertEq(compoundingStakingSSVStrategy.checkBalance(address(mockWeth)), 6 ether);
    }
}
