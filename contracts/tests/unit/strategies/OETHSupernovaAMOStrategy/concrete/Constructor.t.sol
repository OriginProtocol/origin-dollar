// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";
import {OETHSupernovaAMOStrategy} from "contracts/strategies/algebra/OETHSupernovaAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy, OETHVaultProxy} from "contracts/proxies/Proxies.sol";

contract Unit_Concrete_OETHSupernovaAMOStrategy_Constructor_Test is Unit_OETHSupernovaAMOStrategy_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(oethSupernovaAMOStrategy.asset(), address(mockWeth));
        assertEq(oethSupernovaAMOStrategy.oToken(), address(oeth));
        assertEq(oethSupernovaAMOStrategy.pool(), address(mockSwapXPair));
        assertEq(oethSupernovaAMOStrategy.gauge(), address(mockSwapXGauge));
    }

    function test_constructor_reversedTokenOrder() public {
        // Pool with reversed token order (token0=OETH, token1=WETH) — should still succeed
        MockSwapXPair reversedPool = new MockSwapXPair(address(oeth), address(mockWeth));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(reversedPool), address(swpxToken));

        OETHSupernovaAMOStrategy strat = new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(reversedPool), vaultAddress: address(oethVault)
            }),
            address(gauge_)
        );
        assertEq(strat.oToken(), address(oeth));
        assertEq(strat.asset(), address(mockWeth));
    }

    function test_constructor_RevertWhen_incorrectPoolTokens() public {
        // Pool with tokens that don't match vault's oToken/asset
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        MockSwapXPair wrongPool = new MockSwapXPair(address(randomToken), address(oeth));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(wrongPool), address(swpxToken));

        vm.expectRevert("Incorrect pool tokens");
        new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(wrongPool), vaultAddress: address(oethVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectTokenDecimals() public {
        // Create pool with bad-decimal asset and OETH
        MockERC20 badWeth = new MockERC20("Bad WETH", "bWETH", 8);
        MockSwapXPair pool_ = new MockSwapXPair(address(badWeth), address(oeth));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(pool_), address(swpxToken));

        // Deploy a new vault with badWeth as the underlying asset
        OETHVault badVault = _deployVaultWithAsset(address(badWeth));

        vm.expectRevert("Incorrect token decimals");
        new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_), vaultAddress: address(badVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_poolNotStable() public {
        MockSwapXPair unstablePool = new MockSwapXPair(address(mockWeth), address(oeth));
        unstablePool.setStable(false);
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(unstablePool), address(swpxToken));

        vm.expectRevert("Pool not stable");
        new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(unstablePool), vaultAddress: address(oethVault)
            }),
            address(gauge_)
        );
    }

    function test_constructor_RevertWhen_incorrectGauge() public {
        MockSwapXPair pool_ = new MockSwapXPair(address(mockWeth), address(oeth));
        // Gauge pointing to wrong LP token
        MockSwapXGauge wrongGauge = new MockSwapXGauge(address(alice), address(swpxToken));

        vm.expectRevert("Incorrect gauge");
        new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(pool_), vaultAddress: address(oethVault)
            }),
            address(wrongGauge)
        );
    }

    /// @dev Helper to deploy a fresh vault with a custom asset
    function _deployVaultWithAsset(address _asset) internal returns (OETHVault) {
        vm.startPrank(deployer);
        OETH impl = new OETH();
        OETHVault vaultImpl = new OETHVault(_asset);
        OETHProxy proxy = new OETHProxy();
        OETHVaultProxy vaultProxy_ = new OETHVaultProxy();

        proxy.initialize(
            address(impl), governor, abi.encodeWithSignature("initialize(address,uint256)", address(vaultProxy_), 1e27)
        );
        vaultProxy_.initialize(
            address(vaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(proxy))
        );
        vm.stopPrank();

        OETHVault vault = OETHVault(address(vaultProxy_));
        vm.prank(governor);
        vault.unpauseCapital();
        return vault;
    }
}
