// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_UniswapV4LiquidityModule_Shared_Test
} from "tests/smoke/mainnet/automation/UniswapV4LiquidityModule/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

// --- Project imports
import {IUniswapV4LiquidityModule} from "contracts/interfaces/automation/IUniswapV4LiquidityModule.sol";

interface ISafeModules {
    function isModuleEnabled(address module) external view returns (bool);
}

contract Smoke_Concrete_UniswapV4LiquidityModule_Test is Smoke_UniswapV4LiquidityModule_Shared_Test {
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

    function test_module_allowsTheOusdUsdePoolWithOusdCaps() public view {
        assertTrue(module.isPoolAllowed(keccak256(abi.encode(key))));
        assertEq(module.maxPerCall(Mainnet.OUSDProxy), 100_000e18);
        assertEq(module.maxPerDay(Mainnet.OUSDProxy), 200_000e18);
        assertEq(module.maxPerCall(Mainnet.USDe), 0);
        assertFalse(module.paused());
    }

    //////////////////////////////////////////////////////
    /// --- LIVE MOVE
    //////////////////////////////////////////////////////

    /// @dev Take the live [0, 5] position over: burn it and mint OUSD only on [4, 5].
    function test_rebalance_takesTheLivePositionOver() public {
        IUniswapV4LiquidityModule.RebalanceParams memory p;
        p.key = key;
        p.tokenId = Mainnet.ousdUsdeV4PositionId;
        p.tickLower = 4;
        p.tickUpper = 5;
        p.liquidity = 100_000_000e18;
        p.amount0Max = 100_000e18;

        vm.prank(CrossChain.talosRelayer);
        uint256 newTokenId = module.rebalance(p);

        assertEq(positionManager.ownerOf(newTokenId), safe);
        assertEq(positionManager.getPositionLiquidity(newTokenId), 100_000_000e18);
    }
}
