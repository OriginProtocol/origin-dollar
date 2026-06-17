// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Mainnet} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IStrategy} from "contracts/interfaces/IStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_OETHVault_Shared_Test is BaseSmoke {
    IOToken internal oeth;
    IVault internal oethVault;
    IStrategy internal curveAMOStrategy;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oeth = IOToken(resolver.resolve("OETH_PROXY"));
        oethVault = IVault(resolver.resolve("OETH_VAULT_PROXY"));
        curveAMOStrategy = IStrategy(resolver.resolve("OETH_CURVE_AMO_STRATEGY"));
        weth = IERC20(Mainnet.WETH);
    }

    function _resolveActors() internal virtual {
        governor = oethVault.governor();
        strategist = oethVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy");
        vm.label(address(weth), "WETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH, approve vault, and mint OETH for a user
    function _mintOETH(address user, uint256 wethAmount) internal {
        deal(address(weth), user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();
    }

    /// @dev Deal WETH to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldWETH) internal {
        deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + yieldWETH);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        oethVault.rebase();
    }

    /// @dev Deal WETH to the vault so that `_assetAvailable() >= extraWETH` after covering
    /// outstanding withdrawal queue obligations. Also widens maxSupplyDiff for the same
    /// reason as `_ensureVaultLiquidity`.
    function _ensureAssetAvailable(uint256 extraWETH) internal {
        uint256 queued = oethVault.withdrawalQueueMetadata().queued;
        uint256 claimed = oethVault.withdrawalQueueMetadata().claimed;
        uint256 outstanding = queued - claimed;
        uint256 vaultBalance = weth.balanceOf(address(oethVault));
        if (vaultBalance < outstanding + extraWETH) {
            uint256 needed = outstanding + extraWETH - vaultBalance;
            deal(address(weth), address(oethVault), vaultBalance + needed);
        }

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0.1e18);
    }

    /// @dev Ensure the vault has enough WETH liquidity to cover the withdrawal queue plus an extra amount.
    function _ensureVaultLiquidity(uint256 extraWETH) internal {
        uint256 queued = oethVault.withdrawalQueueMetadata().queued;
        uint256 claimable = oethVault.withdrawalQueueMetadata().claimable;
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraWETH;
        deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + needed);

        vm.prank(governor);
        oethVault.setMaxSupplyDiff(0.1e18);

        oethVault.addWithdrawalQueueLiquidity();
    }
}
