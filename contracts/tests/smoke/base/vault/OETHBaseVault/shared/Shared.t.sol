// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IStrategy} from "contracts/interfaces/IStrategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OETHBaseVault_Shared_Test is BaseSmoke {
    IOToken internal oethBase;
    IVault internal oethBaseVault;
    IStrategy internal aerodromeAMOStrategy;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oethBase = IOToken(resolver.resolve("OETHBASE_PROXY"));
        oethBaseVault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));
        aerodromeAMOStrategy = IStrategy(resolver.resolve("AERODROME_AMO_STRATEGY_PROXY"));
        weth = IERC20(BaseAddresses.WETH);
    }

    function _resolveActors() internal virtual {
        governor = oethBaseVault.governor();
        strategist = oethBaseVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(aerodromeAMOStrategy), "AerodromeAMOStrategy");
        vm.label(address(weth), "WETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH, approve vault, and mint OETHBase for a user
    function _mintOETHBase(address user, uint256 wethAmount) internal {
        deal(address(weth), user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(oethBaseVault), wethAmount);
        oethBaseVault.mint(wethAmount);
        vm.stopPrank();
    }

    /// @dev Deal WETH to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldWETH) internal {
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + yieldWETH);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        oethBaseVault.rebase();
    }

    /// @dev Deal WETH to the vault so that `_assetAvailable() >= extraWETH` after covering
    /// outstanding withdrawal queue obligations. Also widens maxSupplyDiff for the same
    /// reason as `_ensureVaultLiquidity`.
    function _ensureAssetAvailable(uint256 extraWETH) internal {
        uint256 queued = oethBaseVault.withdrawalQueueMetadata().queued;
        uint256 claimed = oethBaseVault.withdrawalQueueMetadata().claimed;
        uint256 outstanding = queued - claimed;
        uint256 vaultBalance = weth.balanceOf(address(oethBaseVault));
        if (vaultBalance < outstanding + extraWETH) {
            uint256 needed = outstanding + extraWETH - vaultBalance;
            deal(address(weth), address(oethBaseVault), vaultBalance + needed);
        }

        vm.prank(governor);
        oethBaseVault.setMaxSupplyDiff(0.1e18);
    }

    /// @dev Ensure the vault has enough WETH liquidity to cover the withdrawal queue plus an extra amount.
    /// Deals WETH to the vault and widens maxSupplyDiff to accommodate the artificial
    /// totalValue increase that `deal` introduces (the drip-limited rebase cannot
    /// close the gap in a single block).
    function _ensureVaultLiquidity(uint256 extraWETH) internal {
        uint256 queued = oethBaseVault.withdrawalQueueMetadata().queued;
        uint256 claimable = oethBaseVault.withdrawalQueueMetadata().claimable;
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraWETH;
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + needed);

        // Widen the backing tolerance so the artificial WETH injection doesn't trip
        // the _postRedeem check during claimWithdrawal.
        vm.prank(governor);
        oethBaseVault.setMaxSupplyDiff(0.1e18); // 10% — test-only, accommodates artificial deal

        oethBaseVault.addWithdrawalQueueLiquidity();
    }
}
