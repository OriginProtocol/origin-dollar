// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IBaseCurveAMOStrategy} from "contracts/interfaces/strategies/IBaseCurveAMOStrategy.sol";
import {ICurveStableSwapNG} from "contracts/interfaces/ICurveStableSwapNG.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

abstract contract Smoke_BaseCurveAMOStrategy_Shared_Test is BaseSmoke {
    IOToken internal oethBase;
    IVault internal oethBaseVault;
    IBaseCurveAMOStrategy internal baseCurveAMOStrategy;

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
        baseCurveAMOStrategy = IBaseCurveAMOStrategy(resolver.resolve("OETHBASE_CURVE_AMO_STRATEGY"));
        weth = IERC20(BaseAddresses.WETH);
        crv = IERC20(BaseAddresses.CRV);
    }

    function _resolveActors() internal virtual {
        governor = baseCurveAMOStrategy.governor();
        strategist = oethBaseVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(baseCurveAMOStrategy), "BaseCurveAMOStrategy");
        vm.label(address(weth), "WETH");
        vm.label(address(crv), "CRV");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(weth), address(baseCurveAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        baseCurveAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Tilt pool toward WETH (more WETH, less OETHb)
    function _tiltPoolToWeth(uint256 swapAmount) internal {
        ICurveStableSwapNG curvePool = ICurveStableSwapNG(baseCurveAMOStrategy.curvePool());
        deal(address(weth), address(this), swapAmount);
        weth.approve(address(curvePool), swapAmount);
        uint128 wethIdx = baseCurveAMOStrategy.wethCoinIndex();
        uint128 oethIdx = baseCurveAMOStrategy.oethCoinIndex();
        curvePool.exchange(int128(wethIdx), int128(oethIdx), swapAmount, 0);
    }

    /// @dev Tilt pool toward OETHb (more OETHb, less WETH)
    function _tiltPoolToOeth(uint256 swapAmount) internal {
        ICurveStableSwapNG curvePool = ICurveStableSwapNG(baseCurveAMOStrategy.curvePool());
        deal(address(weth), address(this), swapAmount);
        weth.approve(address(oethBaseVault), swapAmount);
        oethBaseVault.mint(swapAmount);
        oethBase.approve(address(curvePool), swapAmount);
        uint128 wethIdx = baseCurveAMOStrategy.wethCoinIndex();
        uint128 oethIdx = baseCurveAMOStrategy.oethCoinIndex();
        curvePool.exchange(int128(oethIdx), int128(wethIdx), swapAmount, 0);
    }

    /// @dev Ensure pool has excess WETH by tilting if needed.
    function _ensurePoolExcessWeth(uint256 targetExcess) internal {
        ICurveStableSwapNG curvePool = ICurveStableSwapNG(baseCurveAMOStrategy.curvePool());
        uint256[] memory balances = curvePool.get_balances();
        uint128 wethIdx = baseCurveAMOStrategy.wethCoinIndex();
        uint128 oethIdx = baseCurveAMOStrategy.oethCoinIndex();
        int256 diff = int256(balances[wethIdx]) - int256(balances[oethIdx]);

        if (diff < int256(targetExcess)) {
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            _tiltPoolToWeth(shortfall * 2);
        }
    }

    /// @dev Ensure pool has excess OETHb by tilting if needed.
    function _ensurePoolExcessOeth(uint256 targetExcess) internal {
        ICurveStableSwapNG curvePool = ICurveStableSwapNG(baseCurveAMOStrategy.curvePool());
        uint256[] memory balances = curvePool.get_balances();
        uint128 wethIdx = baseCurveAMOStrategy.wethCoinIndex();
        uint128 oethIdx = baseCurveAMOStrategy.oethCoinIndex();
        int256 diff = int256(balances[oethIdx]) - int256(balances[wethIdx]);

        if (diff < int256(targetExcess)) {
            uint256 shortfall = uint256(int256(targetExcess) - diff);
            _tiltPoolToOeth(shortfall * 2);
        }
    }

    /// @dev Seed vault with extra WETH to maintain solvency after minting OETHb
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(weth), address(oethBaseVault), weth.balanceOf(address(oethBaseVault)) + amount);
    }
}
