// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {CrossChain} from "tests/utils/Addresses.sol";
import {ICurveAmoRepegModule} from "contracts/interfaces/automation/ICurveAmoRepegModule.sol";
import {ICurveAMOStrategy} from "contracts/interfaces/strategies/ICurveAMOStrategy.sol";
import {ICurveStableSwapNG} from "contracts/interfaces/ICurveStableSwapNG.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IRepegForkSafe {
    function enableModule(address module) external;
    function isModuleEnabled(address module) external view returns (bool);
}

interface IRepegForkAmo {
    function gauge() external view returns (address);
    function curvePool() external view returns (address);
}

interface IRepegForkChecker {
    function takeSnapshot() external;
    function snapshots(address safe) external view returns (uint256 vaultValue, uint256 totalSupply, uint256 time);
}

abstract contract Fork_CurveAmoRepegModule_Base_Test is BaseFork {
    struct Profile {
        address vault;
        address token;
        address amo;
        address checker;
        uint256 tokenIndex;
        uint256 varianceCap;
    }

    struct Before {
        uint256 stake;
        uint256 quote;
        uint256 poolTokens;
    }

    struct Derived {
        int256 profit;
        int256 vaultChange;
        uint256 burned;
    }

    function _runRepeg(Profile memory profile) internal {
        address safe = IVault(profile.vault).strategistAddr();
        assertEq(safe, CrossChain.multichainStrategist);
        assertFalse(IVault(profile.vault).rebasePaused(), "Fork fixture requires unpaused rebases");
        ICurveStableSwapNG pool = ICurveStableSwapNG(IRepegForkAmo(profile.amo).curvePool());
        assertEq(pool.coins(profile.tokenIndex), profile.token);
        ICurveAmoRepegModule module = ICurveAmoRepegModule(
            vm.deployCode(
                "contracts/automation/CurveAmoRepegModule.sol:CurveAmoRepegModule",
                abi.encode(
                    safe,
                    CrossChain.talosRelayer,
                    profile.vault,
                    profile.amo,
                    profile.checker,
                    profile.varianceCap,
                    profile.varianceCap
                )
            )
        );
        vm.prank(safe);
        IRepegForkSafe(safe).enableModule(address(module));
        assertTrue(IRepegForkSafe(safe).isModuleEnabled(address(module)));

        uint256 lpAmount = _lpAmount(profile, pool);
        uint256 snapshotId = vm.snapshotState();
        Derived memory derived = _derive(profile, safe, lpAmount);
        assertTrue(vm.revertToState(snapshotId));
        assertGt(derived.profit, 0, "Remove-and-burn must have positive profit");
        int256 profitVariance = int256(profile.varianceCap);
        if (derived.profit <= profitVariance) profitVariance = derived.profit - 1;
        Before memory beforeState;
        beforeState.poolTokens = pool.get_balances()[profile.tokenIndex];
        beforeState.quote = _quote(pool, profile.tokenIndex);
        beforeState.stake = IERC20(IRepegForkAmo(profile.amo).gauge()).balanceOf(profile.amo);

        _execute(module, profile, derived, lpAmount, profitVariance);

        assertGt(_quote(pool, profile.tokenIndex), beforeState.quote, "OToken sell quote must improve");
        assertLt(pool.get_balances()[profile.tokenIndex], beforeState.poolTokens);
        (, uint256 postRebaseSupply, uint256 snapshotTime) = IRepegForkChecker(profile.checker).snapshots(safe);
        assertEq(postRebaseSupply - IERC20(profile.token).totalSupply(), derived.burned);
        assertEq(IERC20(IRepegForkAmo(profile.amo).gauge()).balanceOf(profile.amo), beforeState.stake - lpAmount);
        assertEq(module.nonce(), 1);
        assertEq(snapshotTime, block.timestamp);
    }

    function _execute(
        ICurveAmoRepegModule module,
        Profile memory profile,
        Derived memory derived,
        uint256 lpAmount,
        int256 profitVariance
    ) internal {
        vm.prank(CrossChain.talosRelayer);
        module.repeg(
            lpAmount,
            derived.profit,
            profitVariance,
            derived.vaultChange,
            int256(profile.varianceCap),
            0,
            block.timestamp + 5 minutes
        );
    }

    function _quote(ICurveStableSwapNG pool, uint256 tokenIndex) internal view returns (uint256) {
        return pool.get_dy(int128(uint128(tokenIndex)), int128(uint128(1 - tokenIndex)), 1e18);
    }

    function _derive(Profile memory profile, address safe, uint256 lpAmount) internal returns (Derived memory result) {
        vm.startPrank(safe);
        IVault(profile.vault).rebase();
        IRepegForkChecker(profile.checker).takeSnapshot();
        (uint256 valueBefore, uint256 supplyBefore,) = IRepegForkChecker(profile.checker).snapshots(safe);
        ICurveAMOStrategy(profile.amo).removeAndBurnOTokens(lpAmount);
        uint256 valueAfter = IVault(profile.vault).totalValue();
        uint256 supplyAfter = IERC20(profile.token).totalSupply();
        vm.stopPrank();
        result.vaultChange = int256(valueAfter) - int256(valueBefore);
        result.profit = result.vaultChange - (int256(supplyAfter) - int256(supplyBefore));
        result.burned = supplyBefore - supplyAfter;
    }

    function _lpAmount(Profile memory profile, ICurveStableSwapNG pool) internal view returns (uint256 amount) {
        uint256 assetIndex = 1 - profile.tokenIndex;
        uint256[] memory balances = pool.get_balances();
        uint256 assetDecimals = IERC20Metadata(pool.coins(assetIndex)).decimals();
        uint256 normalizedAssets = balances[assetIndex] * 10 ** (18 - assetDecimals);
        require(balances[profile.tokenIndex] > normalizedAssets, "Fork fixture requires excess OTokens");
        uint256 imbalanceBound =
            (balances[profile.tokenIndex] - normalizedAssets) * 1e18 / pool.get_virtual_price() / 10;
        amount = IERC20(IRepegForkAmo(profile.amo).gauge()).balanceOf(profile.amo) / 100;
        if (amount > imbalanceBound) amount = imbalanceBound;
        require(amount > 0, "No LP available");
    }
}
