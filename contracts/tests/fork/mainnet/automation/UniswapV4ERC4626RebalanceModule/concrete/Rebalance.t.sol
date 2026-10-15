// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4ERC4626RebalanceModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4ERC4626RebalanceModule/shared/Shared.t.sol";

contract Fork_Concrete_Mainnet_UniswapV4ERC4626RebalanceModule_Rebalance_Test is
    Fork_Mainnet_UniswapV4ERC4626RebalanceModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_sameRange_pullsSusdeAndMintsNewPosition() public {
        uint256 poolSusdeBefore = susde.balanceOf(address(poolManager));
        _sellSusde(4_000e18);
        uint256 susdeBought = susde.balanceOf(address(poolManager)) - poolSusdeBefore;
        assertGt(susdeBought, 3_900e18);
        uint256 oldTokenId = tokenId;

        uint256 newTokenId = _rebalance(navTick + 1);

        assertGt(newTokenId, oldTokenId);
        assertEq(positionManager.ownerOf(newTokenId), safe);
        assertEq(_liquidity(newTokenId), LIQUIDITY);
        (int24 tickLower, int24 tickUpper) = _range(newTokenId);
        assertEq(tickLower, navTick + 1);
        assertEq(tickUpper, navTick + 6);
        // The old position is gone and everything it bought is in the Safe.
        vm.expectRevert();
        positionManager.ownerOf(oldTokenId);
        assertApproxEqRel(susde.balanceOf(safe), susdeBought, 1e13);
        // Reset to the NAV: the sUSDe cannot be bought back.
        assertEq(_buySusde(1_000e18), 0);
    }

    /// @dev The NAV rises, so the range follows it down; the old range stays above the NAV and the
    ///      new one starts at the new NAV.
    function test_rebalance_navRises_movesRangeDown() public {
        _raiseNav(5);
        uint160 newNav = _navSqrtPriceX96();
        assertLt(newNav, navSqrtPriceX96);

        // Price is still at the old NAV, above the new one: a gas-only reset brings it down.
        uint256 newTokenId = _rebalance(navTick - 3);

        (uint160 price, int24 tick) = _slot0();
        assertEq(price, newNav);
        assertLt(tick, navTick - 3);
        assertEq(_liquidity(newTokenId), LIQUIDITY);
        assertEq(susde.balanceOf(safe), 0);
        // The new range sells OUSD for sUSDe: a seller gets more OUSD than at the old range.
        assertGt(_sellSusde(1_000e18), 0);
    }

    /// @dev The live situation: the range sits well above the NAV and nothing fills. The move is
    ///      a burn, a gas-only reset through the empty ticks and a mint at the NAV.
    function test_rebalance_rangeFarAboveNav() public {
        vm.prank(operator);
        tokenId = module.rebalance(tokenId, navTick + 5, navTick + 19, LIQUIDITY, 0, 0);
        _sellSusde(100e18);
        (uint160 priceBefore,) = _slot0();
        assertGt(priceBefore, navSqrtPriceX96);

        _rebalance(navTick + 1);

        (uint160 price,) = _slot0();
        assertEq(price, navSqrtPriceX96);
    }

    function test_rebalance_burnOnly() public {
        _sellSusde(1_000e18);
        uint256 ousdBefore = ousd.balanceOf(safe);

        vm.prank(operator);
        uint256 newTokenId = module.rebalance(tokenId, 0, 0, 0, 0, 0);

        assertEq(newTokenId, 0);
        assertGt(ousd.balanceOf(safe), ousdBefore);
        assertGt(susde.balanceOf(safe), 0);
    }

    function test_rebalance_mintOnly() public {
        vm.prank(operator);
        module.rebalance(tokenId, 0, 0, 0, 0, 0);

        tokenId = 0;
        uint256 newTokenId = _rebalance(navTick + 1);
        assertEq(_liquidity(newTokenId), LIQUIDITY);
    }

    /// @dev The Safe's one-time max approvals cover every mint.
    function test_rebalance_fiveCyclesInARow() public {
        for (uint256 i = 0; i < 5; i++) {
            _sellSusde(1_000e18);
            _rebalance(navTick + 1);
            assertEq(_liquidity(tokenId), LIQUIDITY);
        }
        assertApproxEqRel(susde.balanceOf(safe), 5_000e18, 1e15);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_priceLimitBelowFloor() public {
        _sellSusde(1_000e18);
        uint160 limit = _floorSqrtPriceX96() - 1;
        vm.prank(operator);
        vm.expectRevert("Price limit below NAV floor");
        module.rebalance(tokenId, navTick + 1, navTick + 6, LIQUIDITY, RESET_AMOUNT0, limit);
    }

    /// @dev Another LP's liquidity below the NAV lets the price fall under it: no mint then, since
    ///      a range starting at the pool price would sell OUSD below the NAV.
    function test_rebalance_RevertWhen_poolPriceBelowFloor() public {
        deal(address(susde), address(otherLp), 1_000_000e18);
        otherLp.modifyLiquidity(key, navTick - 20, navTick, 1e24);
        _buySusde(1_000e18);
        (uint160 price,) = _slot0();
        assertLt(price, navSqrtPriceX96);

        vm.prank(operator);
        vm.expectRevert("Pool price below NAV floor");
        module.rebalance(tokenId, navTick - 5, navTick, LIQUIDITY, 0, 0);
    }

    /// @dev A range starting below the pool price would need sUSDe: amount1Max = 0 rejects it.
    function test_rebalance_RevertWhen_rangeBelowPoolPrice() public {
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(tokenId, navTick, navTick + 5, LIQUIDITY, 0, 0);
    }

    function test_rebalance_RevertWhen_positionNotOwnedBySafe() public {
        vm.prank(safe);
        IERC721Transfer(address(positionManager)).transferFrom(safe, makeAddr("Elsewhere"), tokenId);

        vm.prank(operator);
        vm.expectRevert("Not a Safe position");
        module.rebalance(tokenId, navTick + 1, navTick + 6, LIQUIDITY, 0, 0);
    }
}

interface IERC721Transfer {
    function transferFrom(address from, address to, uint256 id) external;
}
