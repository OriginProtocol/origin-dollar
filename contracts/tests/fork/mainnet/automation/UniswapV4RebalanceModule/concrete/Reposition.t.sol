// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4RebalanceModule} from "contracts/interfaces/automation/IUniswapV4RebalanceModule.sol";

contract Fork_Concrete_Mainnet_UniswapV4RebalanceModule_Reposition_Test is
    Fork_Mainnet_UniswapV4RebalanceModule_Shared_Test
{
    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_reposition_mintsTheNewRangeAndBurnsTheOld() public {
        uint256 oldId = tokenId;
        uint256 newId = _reposition(3);

        assertEq(positionManager.ownerOf(newId), safe);
        assertEq(positionManager.getPositionLiquidity(newId), TARGET_LIQUIDITY);
        vm.expectRevert();
        positionManager.ownerOf(oldId);

        IUniswapV4RebalanceModule.PositionConfig memory cfg = module.getPosition(newId);
        assertEq(cfg.tickLower, 3);
        assertEq(cfg.tickUpper, 8);
        assertEq(module.configuredTokenIds()[0], newId);
        assertEq(module.getPosition(oldId).limits.targetLiquidity, 0);
    }

    /// @dev A deeper range buys USDe cheaper: 3 bps below par at least.
    function test_reposition_deeperRangeBuysUsdeCheaper() public {
        _reposition(3);
        uint256 ousdOut = _sellUsde(1_000e18);
        assertLt(ousdOut, (1_000e18 * (10_000 - 3)) / 10_000);
        assertGt(module.pendingToken1(tokenId), 0);
    }

    /// @dev Moving closer to par while USDe sits in the position: the burn pulls it to the
    ///      Safe and the reset brings the price down to the new bottom.
    function test_reposition_closerToParWithAFill() public {
        _reposition(5);
        _sellUsde(1_000e18);
        uint256 usdeBefore = usde.balanceOf(safe);
        uint256 pending = module.pendingToken1(tokenId);
        assertGt(pending, 0);

        uint256 newId = _reposition(2);

        assertApproxEqRel(usde.balanceOf(safe) - usdeBefore, pending, 1e13);
        assertEq(positionManager.getPositionLiquidity(newId), TARGET_LIQUIDITY);
        assertLe(module.sqrtPriceX96(newId), module.getPosition(newId).sqrtPriceLowerX96);
        assertEq(module.pendingToken1(newId), 0);
    }

    function test_reposition_thenRebalance() public {
        _reposition(2);
        _sellUsde(2_000e18);

        assertTrue(_rebalance());
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertLe(module.sqrtPriceX96(tokenId), _sqrtLower());
    }

    function test_reposition_backAndForth() public {
        for (int24 tick = 1; tick <= 4; tick++) {
            _reposition(tick);
            _sellUsde(500e18);
        }
        _reposition(0);
        assertEq(_liquidity(), TARGET_LIQUIDITY);
        assertEq(module.configuredTokenIds().length, 1);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_reposition_RevertWhen_aboveParFloor() public {
        vm.prank(operator);
        vm.expectRevert("Tick out of bounds");
        module.reposition(tokenId, -1);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _reposition(int24 tickLower) internal returns (uint256 newId) {
        vm.prank(operator);
        newId = module.reposition(tokenId, tickLower);
        tokenId = newId;
    }
}
