// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWrappedSonic} from "tests/mocks/MockWrappedSonic.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OSonicProxy, OSonicVaultProxy} from "contracts/proxies/SonicProxies.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Constructor_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(sonicSwapXAMOStrategy.asset(), address(mockWrappedSonic));
        assertEq(sonicSwapXAMOStrategy.oToken(), address(oSonic));
        assertEq(sonicSwapXAMOStrategy.pool(), address(mockSwapXPair));
        assertEq(sonicSwapXAMOStrategy.gauge(), address(mockSwapXGauge));
    }

    function test_constructor_reversedTokenOrder() public {
        // Pool with reversed token order (token0=OS, token1=wS) — should still succeed
        MockSwapXPair reversedPool = new MockSwapXPair(address(oSonic), address(mockWrappedSonic));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(reversedPool), address(swpxToken));

        SonicSwapXAMOStrategy strat = new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(reversedPool), vaultAddress: address(oSonicVault)
            }),
            address(gauge_)
        );
        assertEq(strat.oToken(), address(oSonic));
        assertEq(strat.asset(), address(mockWrappedSonic));
    }

    function test_constructor_RevertWhen_incorrectPoolTokens() public {
        // Pool with tokens that don't match vault's oToken/asset
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        MockSwapXPair wrongPool = new MockSwapXPair(address(randomToken), address(oSonic));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(wrongPool), address(swpxToken));

        vm.expectRevert("Incorrect pool tokens");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(wrongPool), vaultAddress: address(oSonicVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectTokenDecimals() public {
        // Override vault asset to a token with wrong decimals
        // Use a fresh vault pointing to a bad-decimal asset
        MockERC20 badWs = new MockERC20("Bad wS", "bwS", 8);
        // Create pool with badWs and oSonic
        MockSwapXPair pool_ = new MockSwapXPair(address(badWs), address(oSonic));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(pool_), address(swpxToken));

        // Deploy a new vault with badWs as the underlying asset
        MockWrappedSonic badWrapped = mockWrappedSonic; // reuse mock, we'll mock the decimals
        OSVault badVault = _deployVaultWithAsset(address(badWs));

        vm.expectRevert("Incorrect token decimals");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_), vaultAddress: address(badVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_poolNotStable() public {
        MockSwapXPair unstablePool = new MockSwapXPair(address(mockWrappedSonic), address(oSonic));
        unstablePool.setStable(false);
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(unstablePool), address(swpxToken));

        vm.expectRevert("Pool not stable");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(unstablePool), vaultAddress: address(oSonicVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectGauge() public {
        MockSwapXPair pool_ = new MockSwapXPair(address(mockWrappedSonic), address(oSonic));
        // Gauge pointing to wrong LP token
        MockSwapXGauge wrongGauge = new MockSwapXGauge(address(alice), address(swpxToken));

        vm.expectRevert("Incorrect gauge");
        new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_), vaultAddress: address(oSonicVault)
            }),
            address(wrongGauge)
        );
    }

    /// @dev Helper to deploy a fresh vault with a custom asset
    function _deployVaultWithAsset(address _asset) internal returns (OSVault) {
        vm.startPrank(deployer);
        OSonic impl = new OSonic();
        OSVault vaultImpl = new OSVault(_asset);
        OSonicProxy proxy = new OSonicProxy();
        OSonicVaultProxy vaultProxy = new OSonicVaultProxy();

        proxy.initialize(
            address(impl), governor, abi.encodeWithSignature("initialize(address,uint256)", address(vaultProxy), 1e27)
        );
        vaultProxy.initialize(
            address(vaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(proxy))
        );
        vm.stopPrank();

        OSVault vault = OSVault(address(vaultProxy));
        vm.prank(governor);
        vault.unpauseCapital();
        return vault;
    }
}
