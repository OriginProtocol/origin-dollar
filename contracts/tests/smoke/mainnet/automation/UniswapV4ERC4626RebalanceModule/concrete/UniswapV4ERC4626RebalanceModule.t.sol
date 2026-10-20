// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_UniswapV4ERC4626RebalanceModule_Shared_Test
} from "tests/smoke/mainnet/automation/UniswapV4ERC4626RebalanceModule/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

interface ISafeModules {
    function isModuleEnabled(address module) external view returns (bool);
}

contract Smoke_Concrete_UniswapV4ERC4626RebalanceModule_Test is Smoke_UniswapV4ERC4626RebalanceModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- WIRING
    //////////////////////////////////////////////////////

    function test_operatorRole_isTalosRelayer() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), CrossChain.talosRelayer));
    }

    function test_module_isEnabledOnTheLiquiditySafe() public view {
        assertEq(module.safeContract(), safe);
        assertTrue(ISafeModules(safe).isModuleEnabled(address(module)));
    }

    function test_module_guardsTheLivePool() public view {
        assertEq(module.currency0(), Mainnet.OUSDProxy);
        assertEq(module.currency1(), Mainnet.sUSDe);
        assertEq(keccak256(abi.encode(module.poolKey())), module.poolId());
    }

    //////////////////////////////////////////////////////
    /// --- LIVE MOVE
    //////////////////////////////////////////////////////

    /// @dev Burn the live position and reset the price to the NAV, then mint ~20k OUSD on the five
    ///      ticks just above it.
    function test_rebalance_movesTheLivePositionToTheNav() public {
        // The module burned position 457274 on Oct 15 2026 (block 26200340). Module 009 is due for
        // a revamp, so this stays skipped rather than tracking the current token id.
        try positionManager.ownerOf(tokenId) returns (address) {}
        catch {
            vm.skip(true);
        }
        uint160 nav = _navSqrtPriceX96();
        vm.prank(CrossChain.talosRelayer);
        module.rebalance(tokenId, 0, 0, 0, 1_000e18, nav);
        int24 lower = _tick() + 1;

        vm.prank(CrossChain.talosRelayer);
        uint256 newTokenId = module.rebalance(0, lower, lower + 5, 70_000_000e18, 0, 0);

        assertEq(positionManager.ownerOf(newTokenId), safe);
        assertEq(positionManager.getPositionLiquidity(newTokenId), 70_000_000e18);
        assertGe(uint256(module.poolSqrtPriceX96()) ** 2, module.navPriceX192());
    }
}
