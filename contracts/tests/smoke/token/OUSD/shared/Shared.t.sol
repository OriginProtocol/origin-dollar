// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OUSD_Shared_Test is BaseSmoke {
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
        // Sanity check to ensure resolver is properly initialized on the fork
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        // Fetch the latest implementations
        ousd = OUSD(resolver.resolve("OUSD_PROXY"));
        ousdVault = OUSDVault(payable(resolver.resolve("OUSD_VAULT_PROXY")));
        usdc = IERC20(Mainnet.USDC);
    }

    function _resolveActors() internal virtual {
        governor = ousd.governor();
        strategist = ousdVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(usdc), "USDC");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal USDC, approve vault, and mint OUSD for a user
    function _mintOUSD(address user, uint256 usdcAmount) internal {
        deal(address(usdc), user, usdcAmount);
        vm.startPrank(user);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();
    }

    /// @dev Deal USDC to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldUSDC) internal {
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + yieldUSDC);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        ousdVault.rebase();
    }

    /// @dev Assert the supply invariant: rebasingSupply + nonRebasingSupply ≈ totalSupply
    function _assertSupplyInvariant() internal view {
        uint256 calculatedSupply =
            (ousd.rebasingCreditsHighres() * 1e18) / ousd.rebasingCreditsPerTokenHighres() + ousd.nonRebasingSupply();
        assertApproxEqRel(calculatedSupply, ousd.totalSupply(), 1e14); // 0.01% tolerance
    }

    /// @dev Ensure the vault has enough USDC liquidity to cover the withdrawal queue plus an extra amount.
    ///      On mainnet fork, most USDC may be deployed in strategies, leaving the vault short for claims.
    function _ensureVaultLiquidity(uint256 extraUSDC) internal {
        (uint256 queued, uint256 claimable,,) = ousdVault.withdrawalQueueMetadata();
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraUSDC;
        uint256 currentBalance = usdc.balanceOf(address(ousdVault));
        if (needed > currentBalance) {
            deal(address(usdc), address(ousdVault), needed);
        }
        ousdVault.addWithdrawalQueueLiquidity();
    }
}
