// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {BaseBridgeHelperModule} from "contracts/automation/BaseBridgeHelperModule.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "lib/openzeppelin/interfaces/IERC4626.sol";
import {IWETH9} from "contracts/interfaces/IWETH9.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {BridgedWOETHStrategy} from "contracts/strategies/BridgedWOETHStrategy.sol";
import {Base} from "tests/utils/Addresses.sol";

abstract contract Smoke_BaseBridgeHelperModule_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IVault internal vault;
    IERC4626 internal bridgedWoeth;

    //////////////////////////////////////////////////////
    /// --- ADDRESSES
    //////////////////////////////////////////////////////

    address internal safe;
    address internal baseGovernor;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        baseBridgeHelperModule = BaseBridgeHelperModule(payable(resolver.resolve("BASE_BRIDGE_HELPER_MODULE")));
        vm.label(address(baseBridgeHelperModule), "BaseBridgeHelperModule");

        vault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));
        bridgedWoeth = IERC4626(resolver.resolve("BRIDGED_WOETH"));
        bridgedWOETHStrategy = BridgedWOETHStrategy(resolver.resolve("BRIDGED_WOETH_STRATEGY_PROXY"));
        weth = IERC20(Base.WETH);
        safe = address(baseBridgeHelperModule.safeContract());
        operator = baseBridgeHelperModule.getRoleMember(baseBridgeHelperModule.OPERATOR_ROLE(), 0);
        baseGovernor = Base.governor;
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Fund an address with WETH by wrapping ETH
    function _fundWithWETH(address to, uint256 amount) internal {
        vm.deal(to, to.balance + amount);
        vm.prank(to);
        IWETH9(Base.WETH).deposit{value: amount}();
    }
}
