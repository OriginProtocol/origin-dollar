// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Fork_Mainnet_UniswapV4ERC4626RebalanceModule_Shared_Test
} from "tests/fork/mainnet/automation/UniswapV4ERC4626RebalanceModule/shared/Shared.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- Project imports
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

interface ISafeModules {
    function enableModule(address module) external;
}

/// @dev The first move of the live OUSD/sUSDe position, through a module on the live Safe. The
///      fresh pool of the shared setup only serves to read `navTick` at the fork block.
contract Fork_Concrete_Mainnet_UniswapV4ERC4626RebalanceModule_LivePosition_Test is
    Fork_Mainnet_UniswapV4ERC4626RebalanceModule_Shared_Test
{
    /// @dev ~20k OUSD on 5 ticks, what the live position holds on 14.
    uint128 internal constant LIVE_LIQUIDITY = 70_000_000e18;

    function setUp() public override {
        super.setUp();
        // The Safe and the position only exist from block 26181117.
        if (
            Mainnet.ousdV4LiquiditySafe.code.length == 0
                || positionManager.nextTokenId() <= Mainnet.ousdSusdeV4PositionId
        ) {
            vm.skip(true);
        }

        safe = Mainnet.ousdV4LiquiditySafe;
        key = PoolKey({currency0: address(ousd), currency1: address(susde), fee: 0, tickSpacing: 1, hooks: address(0)});
        module = _deployModule(safe, key);
        tokenId = Mainnet.ousdSusdeV4PositionId;

        // Post-deploy Safe transactions (approvals as in 008, idempotent).
        vm.startPrank(safe);
        ISafeModules(safe).enableModule(address(module));
        ousd.approve(address(permit2), type(uint256).max);
        permit2.approve(address(ousd), address(positionManager), type(uint160).max, type(uint48).max);
        vm.stopPrank();
    }

    function test_live_moveRangeToNav() public {
        (int24 oldLower,) = _range(tokenId);
        assertGt(oldLower, navTick + 1, "live range already at the NAV");
        uint256 ousdBefore = ousd.balanceOf(safe);
        uint256 susdeBefore = susde.balanceOf(safe);

        uint256 newTokenId = _rebalance(navTick + 1, LIVE_LIQUIDITY);

        (uint160 price,) = _slot0();
        assertGe(uint256(price) ** 2, module.navPriceX192());
        (int24 tickLower, int24 tickUpper) = _range(newTokenId);
        assertEq(tickLower, navTick + 1);
        assertEq(tickUpper, navTick + 6);
        assertEq(positionManager.ownerOf(newTokenId), safe);
        // About the same OUSD as before, moved to the new range (the live position never filled).
        assertApproxEqAbs(ousd.balanceOf(safe), ousdBefore, 1_000e18);
        // The live position holds a few sUSDe cents of fills; they land in the Safe.
        assertGe(susde.balanceOf(safe), susdeBefore);
    }

    /// @dev One tick lower than the NAV allows, e.g. -2257 while the NAV is at -2256.6: the
    ///      position would sell OUSD above the NAV price for sUSDe.
    function test_live_RevertWhen_rangeBelowNav() public {
        uint160 limit = _navSqrtPriceX96();
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.rebalance(tokenId, navTick, navTick + 5, LIVE_LIQUIDITY, RESET_AMOUNT0, limit);
    }
}
