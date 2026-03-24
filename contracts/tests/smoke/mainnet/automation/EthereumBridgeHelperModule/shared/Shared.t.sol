// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {EthereumBridgeHelperModule} from "contracts/automation/EthereumBridgeHelperModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {WOETH} from "contracts/token/WOETH.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

abstract contract Smoke_EthereumBridgeHelperModule_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    EthereumBridgeHelperModule internal ethereumBridgeHelperModule;
    WOETH internal woeth;
    IVault internal vault;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safe;
    address internal mainnetGovernor;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        ethereumBridgeHelperModule =
            EthereumBridgeHelperModule(payable(resolver.resolve("ETHEREUM_BRIDGE_HELPER_MODULE")));
        vm.label(address(ethereumBridgeHelperModule), "EthereumBridgeHelperModule");

        vault = IVault(resolver.resolve("OETH_VAULT_PROXY"));
        woeth = WOETH(resolver.resolve("WOETH_PROXY"));
        weth = IERC20(Mainnet.WETH);
        safe = address(ethereumBridgeHelperModule.safeContract());
        operator = ethereumBridgeHelperModule.getRoleMember(ethereumBridgeHelperModule.OPERATOR_ROLE(), 0);
        mainnetGovernor = vault.governor();
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Fund an address with WETH by wrapping ETH
    function _fundWithWETH(address to, uint256 amount) internal {
        vm.deal(to, to.balance + amount);
        vm.prank(to);
        IWETH9(Mainnet.WETH).deposit{value: amount}();
    }

    /// @dev Fund vault with extra WETH so the withdrawal queue can be satisfied
    function _fundVaultWithWETH(uint256 amount) internal {
        uint256 vaultWethBalance = IERC20(Mainnet.WETH).balanceOf(address(vault));
        deal(Mainnet.WETH, address(vault), vaultWethBalance + amount);
    }
}
