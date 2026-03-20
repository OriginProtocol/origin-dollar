// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_OETHCurveAMOStrategy_Shared_Test is BaseSmoke {
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
        curveAMOStrategy = CurveAMOStrategy(resolver.resolve("OETH_CURVE_AMO_STRATEGY"));
        weth = IERC20(Mainnet.WETH);
        crv = IERC20(Mainnet.CRV);
    }

    function _resolveActors() internal virtual {
        governor = curveAMOStrategy.governor();
        strategist = oethVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(curveAMOStrategy), "CurveAMOStrategy");
        vm.label(address(weth), "WETH");
        vm.label(address(crv), "CRV");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(weth), address(curveAMOStrategy), amount);
        vm.prank(address(oethVault));
        curveAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Tilt pool toward hardAsset (more WETH, less OETH)
    function _tiltPoolToHardAsset(uint256 swapAmount) internal {
        deal(address(weth), address(this), swapAmount);
        weth.approve(address(curveAMOStrategy.curvePool()), swapAmount);
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        curveAMOStrategy.curvePool().exchange(int128(hardIdx), int128(otokenIdx), swapAmount, 0);
    }

    /// @dev Tilt pool toward oToken (more OETH, less WETH)
    function _tiltPoolToOToken(uint256 swapAmount) internal {
        deal(address(weth), address(this), swapAmount);
        weth.approve(address(oethVault), swapAmount);
        oethVault.mint(swapAmount);
        IERC20(address(oeth)).approve(address(curveAMOStrategy.curvePool()), swapAmount);
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        curveAMOStrategy.curvePool().exchange(int128(otokenIdx), int128(hardIdx), swapAmount, 0);
    }

    /// @dev Ensure pool has excess hardAsset by tilting if needed.
    ///      Reads current pool balance and swaps enough to create targetExcess.
    function _ensurePoolExcessHardAsset(uint256 targetExcess) internal {
        uint256[] memory balances = curveAMOStrategy.curvePool().get_balances();
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        int256 diff = int256(balances[hardIdx]) - int256(balances[otokenIdx]);

        if (diff < int256(targetExcess)) {
            // Need to swap hardAsset into pool. Due to AMM curve, need roughly 2x the shortfall.
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            _tiltPoolToHardAsset(shortfall * 2);
        }
    }

    /// @dev Ensure pool has excess oToken by tilting if needed.
    function _ensurePoolExcessOToken(uint256 targetExcess) internal {
        uint256[] memory balances = curveAMOStrategy.curvePool().get_balances();
        uint128 hardIdx = curveAMOStrategy.hardAssetCoinIndex();
        uint128 otokenIdx = curveAMOStrategy.otokenCoinIndex();
        int256 diff = int256(balances[otokenIdx]) - int256(balances[hardIdx]);

        if (diff < int256(targetExcess)) {
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            _tiltPoolToOToken(shortfall * 2);
        }
    }

    /// @dev Seed vault with extra WETH to maintain solvency after minting OTokens
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethVault), weth.balanceOf(address(oethVault)) + amount);
    }
}
