// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

import {OETHBase} from "contracts/token/OETHBase.sol";
import {OETHBaseVault} from "contracts/vault/OETHBaseVault.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OETHBase_Shared_Test is BaseSmoke {
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
        // Sanity check to ensure resolver is properly initialized on the fork
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        // Fetch the latest implementations
        oethBase = OETHBase(resolver.resolve("OETHBASE_PROXY"));
        oethBaseVault = OETHBaseVault(payable(resolver.resolve("OETHBASE_VAULT_PROXY")));
        weth = IERC20(BaseAddresses.WETH);
    }

    function _resolveActors() internal virtual {
        governor = oethBase.governor();
        strategist = oethBaseVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
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

    /// @dev Assert the supply invariant: rebasingSupply + nonRebasingSupply ≈ totalSupply
    function _assertSupplyInvariant() internal view {
        uint256 calculatedSupply = (oethBase.rebasingCreditsHighres() * 1e18)
            / oethBase.rebasingCreditsPerTokenHighres() + oethBase.nonRebasingSupply();
        assertApproxEqRel(calculatedSupply, oethBase.totalSupply(), 1e14); // 0.01% tolerance
    }

    /// @dev Ensure the vault has enough WETH liquidity to cover the withdrawal queue plus an extra amount.
    function _ensureVaultLiquidity(uint256 extraWETH) internal {
        (uint256 queued, uint256 claimable,,) = oethBaseVault.withdrawalQueueMetadata();
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraWETH;
        // Use additive deal: existing balance may be fully allocated to prior claimable
        // requests, so we must add on top rather than replace.
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + needed);
        oethBaseVault.addWithdrawalQueueLiquidity();
    }
}
