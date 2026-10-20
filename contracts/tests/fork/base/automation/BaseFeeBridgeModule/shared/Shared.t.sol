// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

/// @dev Test-local handle on BaseFeeBridgeModule; nothing else in the repo consumes it.
interface IBaseFeeBridgeModule {
    function requestWithdrawal(uint256 oethbAmount) external;
    function claimAndBridge() external;
    function bridgeFee(uint256 wethAmount) external view returns (uint256);
    function pendingRequestId() external view returns (uint256);
    function hasPendingRequest() external view returns (bool);
}

abstract contract Fork_Base_BaseFeeBridgeModule_Shared_Test is BaseFork {
    IBaseFeeBridgeModule internal module;
    IVault internal vault;
    IERC20 internal oethb;
    address internal safe;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();

        safe = CrossChain.multichainBuybackOperator;
        vault = IVault(Base.OETHBaseVaultProxy);
        oethb = IERC20(Base.OETHBaseProxy);
        weth = IERC20(Base.WETH);

        module = IBaseFeeBridgeModule(
            vm.deployCode(
                Automation.BASE_FEE_BRIDGE_MODULE,
                abi.encode(
                    safe,
                    operator,
                    Base.OETHBaseVaultProxy,
                    Base.CCIPRouter,
                    Mainnet.CCIPChainSelector,
                    Mainnet.FeeSplitter
                )
            )
        );

        vm.prank(safe);
        (bool success,) = safe.call(abi.encodeWithSignature("enableModule(address)", address(module)));
        require(success, "Failed to enable module");

        vm.deal(safe, 1 ether);
    }

    /// @dev Tops the fee Safe up to `amount` OETHb by minting through the vault, as fees would.
    function _fundSafe(uint256 amount) internal {
        uint256 held = oethb.balanceOf(safe);
        if (held >= amount) return;
        uint256 needed = amount - held + 1; // rebasing tokens can round down by a wei
        deal(Base.WETH, alice, needed);
        vm.startPrank(alice);
        weth.approve(Base.OETHBaseVaultProxy, needed);
        vault.mint(needed);
        oethb.transfer(safe, oethb.balanceOf(alice));
        vm.stopPrank();
    }
}
