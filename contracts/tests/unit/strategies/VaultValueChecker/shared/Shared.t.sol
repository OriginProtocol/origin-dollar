// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVaultValueChecker} from "contracts/interfaces/strategies/IVaultValueChecker.sol";

abstract contract Unit_VaultValueChecker_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;
    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IVaultValueChecker internal ousdChecker;
    IVaultValueChecker internal oethChecker;

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

        IOToken ousdImpl = IOToken(vm.deployCode(Tokens.OUSD));
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(address(usdc)));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));

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

        IOToken oethImpl = IOToken(vm.deployCode(Tokens.OETH));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(mockWeth)));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));

        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // --- Deploy checkers ---
        ousdChecker = IVaultValueChecker(
            vm.deployCode(Strategies.VAULT_VALUE_CHECKER, abi.encode(address(ousdVault), address(ousd)))
        );
        oethChecker = IVaultValueChecker(
            vm.deployCode(Strategies.OETH_VAULT_VALUE_CHECKER, abi.encode(address(oethVault), address(oeth)))
        );
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
    function _takeSnapshotAs(address _user, uint256 _vaultValue, uint256 _supply) internal {
        if (ousd.totalSupply() == 0) {
            _mintOUSD(nick, 1e6);
        }

        _setVaultValue(_vaultValue);

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
