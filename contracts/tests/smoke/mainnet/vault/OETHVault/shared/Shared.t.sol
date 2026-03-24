// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {IStrategy} from "contracts/interfaces/IStrategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OETHVault_Shared_Test is BaseSmoke {
    OETH internal oeth;
    OETHVault internal oethVault;
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

        oeth = OETH(resolver.resolve("OETH_PROXY"));
        oethVault = OETHVault(payable(resolver.resolve("OETH_VAULT_PROXY")));
        curveAMOStrategy = IStrategy(resolver.resolve("OETH_CURVE_AMO_STRATEGY"));
        weth = IERC20(Mainnet.WETH);
    }

    function _resolveActors() internal virtual {
        governor = oeth.governor();
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

    /// @dev Ensure the vault has enough WETH liquidity to cover the withdrawal queue plus an extra amount.
    function _ensureVaultLiquidity(uint256 extraWETH) internal {
        (uint256 queued, uint256 claimable,,) = oethVault.withdrawalQueueMetadata();
        uint256 shortfall = queued > claimable ? queued - claimable : 0;
        uint256 needed = shortfall + extraWETH;
        deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + needed);
        oethVault.addWithdrawalQueueLiquidity();
    }
}
