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
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_OUSD_Shared_Test is BaseSmoke {
    IOToken internal ousd;
    IVault internal ousdVault;

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
        ousd = IOToken(resolver.resolve("OUSD_PROXY"));
        ousdVault = IVault(resolver.resolve("OUSD_VAULT_PROXY"));
        usdc = IERC20(Mainnet.USDC);
    }

    function _resolveActors() internal virtual {
        governor = ousdVault.governor();
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
        uint256 queued = ousdVault.withdrawalQueueMetadata().queued;
        uint256 claimable = ousdVault.withdrawalQueueMetadata().claimable;
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraUSDC;
        // Use additive deal: existing balance may be fully allocated to prior claimable
        // requests, so we must add on top rather than replace.
        deal(address(usdc), address(ousdVault), usdc.balanceOf(address(ousdVault)) + needed);
        ousdVault.addWithdrawalQueueLiquidity();
    }
}
