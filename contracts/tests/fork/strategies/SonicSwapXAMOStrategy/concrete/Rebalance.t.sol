// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Sonic} from "tests/utils/Addresses.sol";
import {Fork_SonicSwapXAMOStrategy_Shared_Test} from "tests/fork/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";

contract Fork_Concrete_SonicSwapXAMOStrategy_Rebalance_Test is Fork_SonicSwapXAMOStrategy_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool (pool has more OS, swap wS in)
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_small() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(3 ether);

        // Vault wS balance unchanged
        assertEq(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        // No residual tokens
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_closeToBalanced() public {
        _depositAsVault(100_000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        (uint256 wsReserves, uint256 osReserves,) = swapXPool.getReserves();
        // 5% of the extra OS
        uint256 extraOS = osReserves - wsReserves;
        uint256 wsAmount = extraOS * 5 / 100 * wsReserves / osReserves;

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(wsAmount);

        // Pool should be more balanced
        (uint256 wsAfter, uint256 osAfter,) = swapXPool.getReserves();
        uint256 diffAfter = osAfter > wsAfter ? osAfter - wsAfter : wsAfter - osAfter;
        assertLt(diffAfter, extraOS);
        // No residual tokens
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_large() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(3000 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_mostOfBalance() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(4400 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_RevertWhen_insufficientLP() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Not enough LP tokens in gauge");
        sonicSwapXAMOStrategy.swapAssetsToPool(2_000_000 ether);
    }

    function test_swapOTokensToPool_RevertWhen_poolHasMoreOS() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreOS(1_000_000 ether);

        // Trying to swap OS when pool already has more OS should worsen balance
        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        sonicSwapXAMOStrategy.swapOTokensToPool(0.001 ether);
    }

    function test_swapAssetsToPool_RevertWhen_overshotPeg() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        // Swap too much wS, overshooting the peg
        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        sonicSwapXAMOStrategy.swapAssetsToPool(5000 ether);
    }

    function test_swapAssetsToPool_RevertWhen_zeroAmount() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        sonicSwapXAMOStrategy.swapAssetsToPool(0);
    }

    function test_swapAssetsToPool_noResidualTokens() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(3 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_RevertWhen_protocolInsolvent() public {
        _makeInsolvent();

        // Add more OS to pool to enable swapAssetsToPool direction
        _tiltPoolToMoreOS(100_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.swapAssetsToPool(10 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool revert when pool has more wS
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_RevertWhen_poolHasMoreWS() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWS(20_000 ether);

        // Trying to swap wS when pool already has more wS should worsen balance
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        sonicSwapXAMOStrategy.swapAssetsToPool(0.0001 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapOTokensToPool (pool has more wS, swap OS in)
    //////////////////////////////////////////////////////

    function test_swapOTokensToPool_small() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWS(2_000_000 ether);

        uint256 vaultWSBefore = IERC20(Sonic.wS).balanceOf(address(oSonicVault));

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(0.3 ether);

        // Vault wS balance unchanged
        assertEq(IERC20(Sonic.wS).balanceOf(address(oSonicVault)), vaultWSBefore);
        // No residual tokens
        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_large() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWS(2_000_000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(5000 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_closeToBalanced() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWS(2_000_000 ether);

        (uint256 wsReserves, uint256 osReserves,) = swapXPool.getReserves();
        // 32% of the extra wS gets close to balanced
        uint256 osAmount = (wsReserves - osReserves) * 32 / 100;

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(osAmount);

        // Pool should be more balanced
        (uint256 wsAfter, uint256 osAfter,) = swapXPool.getReserves();
        uint256 diffBefore = wsReserves - osReserves;
        uint256 diffAfter = wsAfter > osAfter ? wsAfter - osAfter : osAfter - wsAfter;
        assertLt(diffAfter, diffBefore);
    }

    function test_swapOTokensToPool_RevertWhen_overshotPeg() public {
        _depositAsVault(5000 ether);
        _tiltPoolToMoreWS(2_000_000 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        sonicSwapXAMOStrategy.swapOTokensToPool(999_990 ether);
    }

    function test_swapOTokensToPool_RevertWhen_zeroAmount() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWS(20_000 ether);

        vm.prank(strategist);
        vm.expectRevert("Must swap something");
        sonicSwapXAMOStrategy.swapOTokensToPool(0);
    }

    function test_swapOTokensToPool_noResidualTokens() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWS(20_000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapOTokensToPool(8 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
        assertEq(IERC20(address(swapXPool)).balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapOTokensToPool_RevertWhen_protocolInsolvent() public {
        // Add more wS to pool to enable swapOTokensToPool direction first
        _tiltPoolToMoreWS(100_000 ether);

        // Then make insolvent (after tilt so vault value increase is accounted for)
        _makeInsolvent();

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        sonicSwapXAMOStrategy.swapOTokensToPool(10 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapOTokensToPool revert with little more wS
    //////////////////////////////////////////////////////

    function test_swapOTokensToPool_RevertWhen_overshotPeg_littleMore() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWS(20_000 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens overshot peg");
        sonicSwapXAMOStrategy.swapOTokensToPool(11_000 ether);
    }

    function test_swapAssetsToPool_RevertWhen_poolHasMoreWS_little() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreWS(20_000 ether);

        // Trying to swap wS when pool already has more wS should worsen balance
        vm.prank(strategist);
        vm.expectRevert("Assets balance worse");
        sonicSwapXAMOStrategy.swapAssetsToPool(0.0001 ether);
    }

    //////////////////////////////////////////////////////
    /// --- swapAssetsToPool with little more OS
    //////////////////////////////////////////////////////

    function test_swapAssetsToPool_smallWithLittleMoreOS() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(3 ether);

        assertEq(oSonic.balanceOf(address(sonicSwapXAMOStrategy)), 0);
    }

    function test_swapAssetsToPool_closeToBalancedWithLittleMoreOS() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        (uint256 wsReserves, uint256 osReserves,) = swapXPool.getReserves();
        // 50% of the extra OS gets close to balanced
        uint256 extraOS = osReserves - wsReserves;
        uint256 wsAmount = extraOS * 50 / 100 * wsReserves / osReserves;

        vm.prank(strategist);
        sonicSwapXAMOStrategy.swapAssetsToPool(wsAmount);

        (uint256 wsAfter, uint256 osAfter,) = swapXPool.getReserves();
        uint256 diffAfter = osAfter > wsAfter ? osAfter - wsAfter : wsAfter - osAfter;
        assertLt(diffAfter, extraOS);
    }

    function test_swapOTokensToPool_RevertWhen_poolHasMoreOS_little() public {
        _depositAsVault(20_000 ether);
        _tiltPoolToMoreOS(5000 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        sonicSwapXAMOStrategy.swapOTokensToPool(0.001 ether);
    }
}
