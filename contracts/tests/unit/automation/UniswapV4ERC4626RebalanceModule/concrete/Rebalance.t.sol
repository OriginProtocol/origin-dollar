// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_UniswapV4ERC4626RebalanceModule_Shared_Test
} from "tests/unit/automation/UniswapV4ERC4626RebalanceModule/shared/Shared.t.sol";

// --- Project imports
import {IUniswapV4ERC4626RebalanceModule} from "contracts/interfaces/automation/IUniswapV4ERC4626RebalanceModule.sol";
import {PoolKey} from "contracts/interfaces/uniswap/v4/IPoolManager.sol";

contract Unit_Concrete_UniswapV4ERC4626RebalanceModule_Rebalance_Test is
    Unit_UniswapV4ERC4626RebalanceModule_Shared_Test
{
    uint256 internal constant BURNED0 = 9_000e18;
    uint256 internal constant BURNED1 = 8_000e18;
    uint256 internal constant MINTED0 = 20_000e18;

    int24 internal constant NEW_LOWER = -2256;
    int24 internal constant NEW_UPPER = -2251;

    /// @dev Inside the old range, above the NAV: the position holds some token1.
    uint160 internal constant SQRT_PRICE_IN_RANGE = SQRT_PRICE_NAV + 1e25;

    function setUp() public override {
        super.setUp();
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_IN_RANGE);
        positionManager.setAmounts(BURNED0, BURNED1, MINTED0, 0);
        poolManager.setSwapResult(0, 0, SQRT_PRICE_NAV);
    }

    //////////////////////////////////////////////////////
    /// --- PASSING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_burnsResetsAndMints() public {
        poolManager.setSwapResult(-500e18, 399e18, SQRT_PRICE_NAV);
        uint256 expectedId = positionManager.nextTokenId();

        vm.expectCall(address(positionManager), _modifyCall(0x03, abi.encode(TOKEN_ID, uint128(0), uint128(0), "")));
        vm.expectCall(
            address(positionManager),
            _modifyCall(
                0x02,
                abi.encode(
                    key, NEW_LOWER, NEW_UPPER, uint256(LIQUIDITY), MAX_AMOUNT0, uint128(0), address(mockSafe), ""
                )
            )
        );
        vm.expectEmit(true, true, false, true, address(module));
        emit IUniswapV4ERC4626RebalanceModule.Rebalanced(
            TOKEN_ID, expectedId, NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0
        );

        uint256 newTokenId = _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV);

        assertEq(newTokenId, expectedId);
        assertEq(positionManager.ownerOf(newTokenId), address(mockSafe));
        assertEq(positionManager.getPositionLiquidity(newTokenId), LIQUIDITY);
        vm.expectRevert("NOT_MINTED");
        positionManager.ownerOf(TOKEN_ID);
        assertEq(token1.balanceOf(address(mockSafe)), BURNED1 + 399e18);
        assertEq(token0.balanceOf(address(mockSafe)), SAFE_TOKEN0 + BURNED0 - 500e18 - MINTED0);
        assertEq(token0.balanceOf(address(module)), 0);
        assertEq(token1.balanceOf(address(module)), 0);
    }

    function test_rebalance_resetSwapIsExactInZeroForOneAtTheLimit() public {
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV);

        (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) = poolManager.lastSwapParams();
        assertTrue(zeroForOne);
        assertEq(amountSpecified, -int256(uint256(RESET_AMOUNT0)));
        assertEq(sqrtPriceLimitX96, SQRT_PRICE_NAV);
    }

    function test_rebalance_burnOnly() public {
        uint256 newTokenId = _rebalance(0, 0, 0, 0, 0);

        assertEq(newTokenId, 0);
        assertEq(positionManager.modifyCount(), 1);
        assertEq(poolManager.swapCount(), 0);
        assertEq(token1.balanceOf(address(mockSafe)), BURNED1);
    }

    function test_rebalance_mintOnly_noTokenId() public {
        vm.prank(operator);
        uint256 newTokenId = module.rebalance(0, NEW_LOWER, NEW_UPPER, LIQUIDITY, 0, 0);

        assertEq(positionManager.modifyCount(), 1);
        assertEq(positionManager.getPositionLiquidity(newTokenId), LIQUIDITY);
        assertEq(positionManager.ownerOf(TOKEN_ID), address(mockSafe));
    }

    /// @dev The NAV only rises, so a range set at an older NAV stays valid.
    function test_rebalance_navRose_oldPriceStillAccepted() public {
        token1.setSharesPerAsset(0.79e18);
        _rebalance(TICK_LOWER, TICK_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV);
    }

    function test_rebalance_poolPriceExactlyAtNav() public {
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_NAV);
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, 0, 0);
    }

    function test_rebalance_safeCanCall() public {
        vm.prank(address(mockSafe));
        module.rebalance(TOKEN_ID, 0, 0, 0, 0, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTING TESTS
    //////////////////////////////////////////////////////

    function test_rebalance_RevertWhen_callerIsNotOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.rebalance(TOKEN_ID, 0, 0, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_positionNotOwnedBySafe() public {
        positionManager.setPosition(TOKEN_ID, alice, key, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.expectRevert("Not a Safe position");
        _rebalance(0, 0, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_wrongPool() public {
        PoolKey memory other = key;
        other.fee = 100;
        positionManager.setPosition(TOKEN_ID, address(mockSafe), other, TICK_LOWER, TICK_UPPER, LIQUIDITY);
        vm.expectRevert("Wrong pool");
        _rebalance(0, 0, 0, 0, 0);
    }

    function test_rebalance_RevertWhen_resetTooLarge() public {
        vm.expectRevert("Reset too large");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, MAX_AMOUNT0 + 1, SQRT_PRICE_NAV);
    }

    function test_rebalance_RevertWhen_priceLimitBelowNav() public {
        vm.expectRevert("Price limit below NAV");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV - 1);
    }

    /// @dev Once the NAV rises past the limit, the same limit is refused.
    function test_rebalance_RevertWhen_navRoseAboveLimit() public {
        token1.setSharesPerAsset(0.81e18);
        vm.expectRevert("Price limit below NAV");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV);
    }

    function test_rebalance_RevertWhen_poolPriceBelowNav() public {
        poolManager.setSqrtPrice(poolId, SQRT_PRICE_NAV - 1);
        vm.expectRevert("Pool price below NAV");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, 0, 0);
    }

    /// @dev The reset leaves the price below the NAV only if the pool misbehaves; the mint still
    ///      checks the pool price.
    function test_rebalance_RevertWhen_resetEndsBelowNav() public {
        poolManager.setSwapResult(0, 0, SQRT_PRICE_NAV - 1);
        vm.expectRevert("Pool price below NAV");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, RESET_AMOUNT0, SQRT_PRICE_NAV);
    }

    /// @dev amount1Max = 0: a mint that needs token1 fails in the PositionManager.
    function test_rebalance_RevertWhen_mintNeedsToken1() public {
        positionManager.setAmounts(BURNED0, BURNED1, MINTED0, 1);
        vm.expectRevert("Safe call failed");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, 0, 0);
    }

    function test_rebalance_RevertWhen_mintAboveMaxAmount0() public {
        positionManager.setAmounts(BURNED0, BURNED1, MAX_AMOUNT0 + 1, 0);
        vm.expectRevert("Safe call failed");
        _rebalance(NEW_LOWER, NEW_UPPER, LIQUIDITY, 0, 0);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _modifyCall(uint8 action, bytes memory params) internal view returns (bytes memory) {
        bytes[] memory all = new bytes[](3);
        all[0] = params;
        all[1] = abi.encode(key.currency0);
        all[2] = abi.encode(key.currency1);
        return abi.encodeWithSignature(
            "modifyLiquidities(bytes,uint256)",
            abi.encode(abi.encodePacked(action, uint8(0x12), uint8(0x12)), all),
            block.timestamp
        );
    }
}
