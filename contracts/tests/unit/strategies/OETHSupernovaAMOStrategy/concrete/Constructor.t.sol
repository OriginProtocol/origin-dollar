// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_OETHSupernovaAMOStrategy_Shared_Test
} from "tests/unit/strategies/OETHSupernovaAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

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

        IOETHSupernovaAMOStrategy strat = IOETHSupernovaAMOStrategy(
            vm.deployCode(
                Strategies.OETH_SUPERNOVA_AMO_STRATEGY,
                abi.encode(address(reversedPool), address(oethVault), address(gauge_))
            )
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
        vm.deployCode(
            Strategies.OETH_SUPERNOVA_AMO_STRATEGY, abi.encode(address(wrongPool), address(oethVault), address(gauge_))
        );
    }

    function test_constructor_RevertWhen_incorrectTokenDecimals() public {
        // Create pool with bad-decimal asset and OETH
        MockERC20 badWeth = new MockERC20("Bad WETH", "bWETH", 8);
        MockSwapXPair pool_ = new MockSwapXPair(address(badWeth), address(oeth));
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(pool_), address(swpxToken));

        // Deploy a new vault with badWeth as the underlying asset
        IVault badVault = _deployVaultWithAsset(address(badWeth));

        vm.expectRevert("Incorrect token decimals");
        vm.deployCode(
            Strategies.OETH_SUPERNOVA_AMO_STRATEGY, abi.encode(address(pool_), address(badVault), address(gauge_))
        );
    }

    function test_constructor_RevertWhen_poolNotStable() public {
        MockSwapXPair unstablePool = new MockSwapXPair(address(mockWeth), address(oeth));
        unstablePool.setStable(false);
        MockSwapXGauge gauge_ = new MockSwapXGauge(address(unstablePool), address(swpxToken));

        vm.expectRevert("Pool not stable");
        vm.deployCode(
            Strategies.OETH_SUPERNOVA_AMO_STRATEGY,
            abi.encode(address(unstablePool), address(oethVault), address(gauge_))
        );
    }

    function test_constructor_RevertWhen_incorrectGauge() public {
        MockSwapXPair pool_ = new MockSwapXPair(address(mockWeth), address(oeth));
        // Gauge pointing to wrong LP token
        MockSwapXGauge wrongGauge = new MockSwapXGauge(address(alice), address(swpxToken));

        vm.expectRevert("Incorrect gauge");
        vm.deployCode(
            Strategies.OETH_SUPERNOVA_AMO_STRATEGY, abi.encode(address(pool_), address(oethVault), address(wrongGauge))
        );
    }

    /// @dev Helper to deploy a fresh vault with a custom asset
    function _deployVaultWithAsset(address _asset) internal returns (IVault) {
        vm.startPrank(deployer);
        IOToken impl = IOToken(vm.deployCode(Tokens.OETH));
        address vaultImpl = vm.deployCode(Vaults.OETH, abi.encode(_asset));
        IProxy proxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        IProxy vaultProxy_ = IProxy(vm.deployCode(Proxies.IG_PROXY));

        proxy.initialize(
            address(impl), governor, abi.encodeWithSignature("initialize(address,uint256)", address(vaultProxy_), 1e27)
        );
        vaultProxy_.initialize(
            address(vaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(proxy))
        );
        vm.stopPrank();

        IVault vault = IVault(address(vaultProxy_));
        vm.prank(governor);
        vault.unpauseCapital();
        return vault;
    }
}
