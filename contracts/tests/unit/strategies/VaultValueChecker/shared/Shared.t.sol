// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {OUSD} from "contracts/token/OUSD.sol";
import {OUSDVault} from "contracts/vault/OUSDVault.sol";
import {OUSDProxy} from "contracts/proxies/Proxies.sol";
import {VaultProxy} from "contracts/proxies/Proxies.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy} from "contracts/proxies/Proxies.sol";
import {OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {VaultValueChecker, OETHVaultValueChecker} from "contracts/strategies/VaultValueChecker.sol";

abstract contract Unit_VaultValueChecker_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        // Warp past SNAPSHOT_EXPIRES (300s) to avoid underflow in checkDelta
        vm.warp(1000);

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // --- Deploy OUSD stack ---
        usdc = IERC20(address(new MockERC20("USD Coin", "USDC", 6)));

        vm.startPrank(deployer);

        OUSD ousdImpl = new OUSD();
        OUSDVault ousdVaultImpl = new OUSDVault(address(usdc));

        ousdProxy = new OUSDProxy();
        ousdVaultProxy = new VaultProxy();

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = OUSD(address(ousdProxy));
        ousdVault = OUSDVault(address(ousdVaultProxy));

        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // --- Deploy OETH stack ---
        mockWeth = new MockWETH();
        weth = IERC20(address(mockWeth));

        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(mockWeth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));

        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // --- Deploy checkers ---
        // ousdChecker uses real OUSD + OUSDVault
        ousdChecker = new VaultValueChecker(address(ousdVault), address(ousd));
        // oethChecker uses real OETH + OETHVault
        oethChecker = new OETHVaultValueChecker(address(oethVault), address(oeth));
    }

    function _labelContracts() internal {
        vm.label(address(ousdChecker), "VaultValueChecker");
        vm.label(address(oethChecker), "OETHVaultValueChecker");
        vm.label(address(usdc), "USDC");
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(address(mockWeth), "MockWETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint OUSD for a user via vault (deposits USDC)
    function _mintOUSD(address user, uint256 usdcAmount) internal {
        MockERC20(address(usdc)).mint(user, usdcAmount);
        vm.startPrank(user);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();
    }

    /// @dev Set vault value by dealing USDC directly to vault.
    ///      totalValue = USDC balance * 1e12
    function _setVaultValue(uint256 _value18) internal {
        uint256 usdcAmount = _value18 / 1e12;
        deal(address(usdc), address(ousdVault), usdcAmount);
    }

    /// @dev Set up vault with known totalValue and totalSupply, then take snapshot.
    ///      Mints OUSD first (creating rebasing supply), then adjusts vault value
    ///      and supply independently.
    function _takeSnapshotAs(address _user, uint256 _vaultValue, uint256 _supply) internal {
        // Ensure there is rebasing supply (mint if totalSupply == 0)
        // Must mint to an EOA so OUSD counts it as rebasing (contracts auto-opt-out)
        if (ousd.totalSupply() == 0) {
            _mintOUSD(nick, 1e6);
        }

        // Set vault value by dealing USDC
        _setVaultValue(_vaultValue);

        // Set supply via changeSupply
        vm.prank(address(ousdVault));
        ousd.changeSupply(_supply);

        vm.prank(_user);
        ousdChecker.takeSnapshot();
    }

    /// @dev Update vault state to new values (for use between snapshot and checkDelta)
    function _setVaultState(uint256 _vaultValue, uint256 _supply) internal {
        _setVaultValue(_vaultValue);
        vm.prank(address(ousdVault));
        ousd.changeSupply(_supply);
    }

    /// @dev Mint OETH for a user via vault (deposits WETH)
    function _mintOETH(address user, uint256 wethAmount) internal {
        deal(address(mockWeth), user, wethAmount);
        vm.startPrank(user);
        weth.approve(address(oethVault), wethAmount);
        oethVault.mint(wethAmount);
        vm.stopPrank();
    }

    /// @dev Set OETH vault value by dealing WETH directly to vault.
    function _setOethVaultValue(uint256 _value18) internal {
        deal(address(mockWeth), address(oethVault), _value18);
    }

    /// @dev Set up OETH vault with known totalValue and totalSupply, then take snapshot.
    function _takeOethSnapshotAs(address _user, uint256 _vaultValue, uint256 _supply) internal {
        if (oeth.totalSupply() == 0) {
            _mintOETH(nick, 1 ether);
        }

        _setOethVaultValue(_vaultValue);

        vm.prank(address(oethVault));
        oeth.changeSupply(_supply);

        vm.prank(_user);
        oethChecker.takeSnapshot();
    }

    /// @dev Update OETH vault state to new values
    function _setOethVaultState(uint256 _vaultValue, uint256 _supply) internal {
        _setOethVaultValue(_vaultValue);
        vm.prank(address(oethVault));
        oeth.changeSupply(_supply);
    }
}
