// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IStrategy} from "contracts/interfaces/IStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_OSVault_Shared_Test is BaseSmoke {
    IOToken internal oSonic;
    IVault internal oSonicVault;
    IStrategy internal sonicSwapXAMOStrategy;
    address internal sonicStakingStrategy;
    IERC20 internal wrappedSonic;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oSonic = IOToken(resolver.resolve("OSONIC_PROXY"));
        oSonicVault = IVault(resolver.resolve("OSONIC_VAULT_PROXY"));
        sonicStakingStrategy = resolver.resolve("SONIC_STAKING_STRATEGY");
        sonicSwapXAMOStrategy = IStrategy(resolver.resolve("SONIC_SWAPX_AMO_STRATEGY_PROXY"));
        wrappedSonic = IERC20(Sonic.wS);
    }

    function _resolveActors() internal virtual {
        governor = oSonicVault.governor();
        strategist = oSonicVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSVault");
        vm.label(sonicStakingStrategy, "SonicStakingStrategy");
        vm.label(address(sonicSwapXAMOStrategy), "SonicSwapXAMOStrategy");
        vm.label(address(wrappedSonic), "wS");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal wS, approve vault, and mint OSonic for a user
    function _mintOSonic(address user, uint256 wsAmount) internal {
        deal(address(wrappedSonic), user, wsAmount);
        vm.startPrank(user);
        wrappedSonic.approve(address(oSonicVault), wsAmount);
        oSonicVault.mint(wsAmount);
        vm.stopPrank();
    }

    /// @dev Deal wS to vault as yield, warp 1 second, then call vault.rebase()
    function _rebase(uint256 yieldWS) internal {
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + yieldWS);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        oSonicVault.rebase();
    }

    /// @dev Ensure the vault has enough wS liquidity to cover the withdrawal queue plus an extra amount.
    function _ensureVaultLiquidity(uint256 extraWS) internal {
        uint256 queued = oSonicVault.withdrawalQueueMetadata().queued;
        uint256 claimable = oSonicVault.withdrawalQueueMetadata().claimable;
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraWS;
        deal(address(wrappedSonic), address(oSonicVault), wrappedSonic.balanceOf(address(oSonicVault)) + needed);
        oSonicVault.addWithdrawalQueueLiquidity();
    }
}
