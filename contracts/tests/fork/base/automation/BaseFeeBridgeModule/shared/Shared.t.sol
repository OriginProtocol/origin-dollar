// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Automation} from "tests/utils/artifacts/Automation.sol";
import {Base, CrossChain, Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "contracts/interfaces/IVault.sol";

/// @dev Test-local handle on BaseFeeBridgeModule; nothing else in the repo consumes it.
interface IBaseFeeBridgeModule {
    function swapAndBridge(uint256 oethbAmount, uint256 minWethOut) external;
    function maxSlippageBps() external view returns (uint256);
    function bridgeFee(uint256 wethAmount) external view returns (uint256);
}

interface ICurvePoolQuote {
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);
}

abstract contract Fork_Base_BaseFeeBridgeModule_Shared_Test is BaseFork {
    uint256 internal constant MAX_SLIPPAGE = 50;

    IBaseFeeBridgeModule internal module;
    IERC20 internal oethb;
    address internal safe;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();

        safe = CrossChain.multichainBuybackOperator;
        oethb = IERC20(Base.OETHBaseProxy);
        weth = IERC20(Base.WETH);

        module = IBaseFeeBridgeModule(
            vm.deployCode(
                Automation.BASE_FEE_BRIDGE_MODULE,
                abi.encode(
                    safe,
                    operator,
                    Base.OETHBaseProxy,
                    Base.WETH,
                    Base.OETHb_WETH_pool,
                    Base.CCIPRouter,
                    Mainnet.CCIPChainSelector,
                    Mainnet.FeeSplitter,
                    MAX_SLIPPAGE
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
        IVault(Base.OETHBaseVaultProxy).mint(needed);
        oethb.transfer(safe, oethb.balanceOf(alice));
        vm.stopPrank();
    }

    /// @dev Quote OETHb (coins[1]) -> WETH (coins[0]) on the Curve AMO pool.
    function _quote(uint256 amount) internal view returns (uint256) {
        return ICurvePoolQuote(Base.OETHb_WETH_pool).get_dy(1, 0, amount);
    }
}
