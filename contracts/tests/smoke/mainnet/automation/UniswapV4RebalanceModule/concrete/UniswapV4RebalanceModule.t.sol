// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Smoke_UniswapV4RebalanceModule_Shared_Test
} from "tests/smoke/mainnet/automation/UniswapV4RebalanceModule/shared/Shared.t.sol";

// --- Test utilities
import {CrossChain, Mainnet} from "tests/utils/Addresses.sol";

// --- Project imports

interface ISafeModules {
    function isModuleEnabled(address module) external view returns (bool);
}

contract Smoke_Concrete_UniswapV4RebalanceModule_Test is Smoke_UniswapV4RebalanceModule_Shared_Test {
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
        assertEq(module.poolId(), 0xa6075a4d90b1de293e0347fa4319584d2b57c0c6faf576a4bd4108450ec45622);
        assertEq(keccak256(abi.encode(key)), module.poolId());
        assertEq(module.minSqrtPriceX96(), 2 ** 96);
        assertEq(positionManager.ownerOf(tokenId), safe);
    }

    //////////////////////////////////////////////////////
    /// --- REBALANCE
    //////////////////////////////////////////////////////

    /// @dev Stock the Safe needs to put back the OUSD the USDe sellers took. Minted here; in
    ///      production it comes from redeeming the USDe and minting OUSD at the Vault.
    function test_rebalance_afterAUsdeSale_keepsTheUsdeInTheSafe() public {
        vm.prank(ousd.vaultAddress());
        ousd.mint(safe, 20_000e18);

        _sellUsde(1_000e18);
        uint256 usdeBefore = usde.balanceOf(safe);
        uint128 liquidity = positionManager.getPositionLiquidity(tokenId);
        assertGt(_sqrtPrice(), module.minSqrtPriceX96());

        _rebalance(liquidity);

        assertGt(usde.balanceOf(safe), usdeBefore);
        assertEq(positionManager.getPositionLiquidity(tokenId), liquidity);
        assertLe(_sqrtPrice(), module.minSqrtPriceX96());
    }
}
