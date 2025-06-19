// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractLZBridgeHelperModule } from "./AbstractLZBridgeHelperModule.sol";

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import { IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

contract EthereumBridgeHelperModule is
    AccessControlEnumerable,
    AbstractLZBridgeHelperModule
{
    IVault public constant vault =
        IVault(0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab);
    IWETH9 public constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public constant oeth =
        IERC20(0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3);
    IERC4626 public constant woeth =
        IERC4626(0xDcEe70654261AF21C44c093C300eD3Bb97b78192);

    uint32 public constant LZ_PLUME_ENDPOINT_ID = 30370;
    IOFT public constant LZ_WOETH_OMNICHAIN_ADAPTER =
        IOFT(0x7d1bEa5807e6af125826d56ff477745BB89972b8);
    IOFT public constant LZ_ETH_OMNICHAIN_ADAPTER =
        IOFT(0x77b2043768d28E9C9aB44E1aBfC95944bcE57931);

    constructor(address _safeContract)
        AbstractLZBridgeHelperModule(_safeContract)
    {}

    /**
     * @dev Bridges wOETH to Plume.
     * @param woethAmount Amount of wOETH to bridge.
     * @param slippageBps Slippage in 10^4 basis points.
     */
    function bridgeWOETHToPlume(uint256 woethAmount, uint256 slippageBps)
        public
        payable
        onlyOperator
    {
        _bridgeTokenWithLz(
            LZ_PLUME_ENDPOINT_ID,
            woeth,
            LZ_WOETH_OMNICHAIN_ADAPTER,
            woethAmount,
            slippageBps,
            false
        );
    }

    /**
     * @dev Bridges wETH to Plume.
     * @param wethAmount Amount of wETH to bridge.
     * @param slippageBps Slippage in 10^4 basis points.
     */
    function bridgeWETHToPlume(uint256 wethAmount, uint256 slippageBps)
        public
        payable
        onlyOperator
    {
        // Unwrap into ETH
        safeContract.execTransactionFromModule(
            address(weth),
            0, // Value
            abi.encodeWithSelector(weth.withdraw.selector, wethAmount),
            0 // Call
        );

        _bridgeTokenWithLz(
            LZ_PLUME_ENDPOINT_ID,
            IERC20(address(weth)),
            LZ_ETH_OMNICHAIN_ADAPTER,
            wethAmount,
            slippageBps,
            true
        );
    }

    /**
     * @dev Mints OETH and wraps it into wOETH.
     * @param wethAmount Amount of WETH to mint.
     * @return Amount of wOETH minted.
     */
    function mintAndWrap(uint256 wethAmount)
        external
        onlyOperator
        returns (uint256)
    {
        return _mintAndWrap(wethAmount);
    }

    /**
     * @dev Mints OETH and wraps it into wOETH.
     * @param wethAmount Amount of WETH to mint.
     * @return Amount of wOETH minted.
     */
    function _mintAndWrap(uint256 wethAmount) internal returns (uint256) {
        // Approve Vault to move WETH
        bool success = safeContract.execTransactionFromModule(
            address(weth),
            0, // Value
            abi.encodeWithSelector(
                weth.approve.selector,
                address(vault),
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve WETH");

        // Mint OETH
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.mint.selector,
                address(weth),
                wethAmount,
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to mint OETH");

        // Approve wOETH to move OETH
        success = safeContract.execTransactionFromModule(
            address(oeth),
            0, // Value
            abi.encodeWithSelector(
                oeth.approve.selector,
                address(woeth),
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve OETH");

        uint256 woethAmount = woeth.balanceOf(address(safeContract));

        // Wrap OETH into wOETH
        success = safeContract.execTransactionFromModule(
            address(woeth),
            0, // Value
            abi.encodeWithSelector(
                woeth.deposit.selector,
                wethAmount,
                address(safeContract)
            ),
            0 // Call
        );
        require(success, "Failed to wrap OETH");

        // Compute amount of wOETH minted
        return woeth.balanceOf(address(safeContract)) - woethAmount;
    }

    /**
     * @dev Mints OETH and wraps it into wOETH, then bridges it to Plume.
     * @param wethAmount Amount of WETH to mint.
     * @param slippageBps Bridge slippage in 10^4 basis points.
     */
    function mintWrapAndBridgeToPlume(uint256 wethAmount, uint256 slippageBps)
        external
        payable
        onlyOperator
    {
        uint256 woethAmount = _mintAndWrap(wethAmount);
        bridgeWOETHToPlume(woethAmount, slippageBps);
    }

    /**
     * @dev Unwraps wOETH and redeems it to get WETH.
     * @param woethAmount Amount of wOETH to unwrap.
     * @return Amount of WETH received.
     */
    function unwrapAndRedeem(uint256 woethAmount)
        external
        onlyOperator
        returns (uint256)
    {
        return _unwrapAndRedeem(woethAmount);
    }

    /**
     * @dev Unwraps wOETH and redeems it to get WETH.
     * @param woethAmount Amount of wOETH to unwrap.
     * @return Amount of WETH received.
     */
    function _unwrapAndRedeem(uint256 woethAmount) internal returns (uint256) {
        uint256 oethAmount = oeth.balanceOf(address(safeContract));

        // Unwrap wOETH
        bool success = safeContract.execTransactionFromModule(
            address(woeth),
            0, // Value
            abi.encodeWithSelector(
                woeth.redeem.selector,
                woethAmount,
                address(safeContract),
                address(safeContract)
            ),
            0 // Call
        );
        require(success, "Failed to unwrap wOETH");

        oethAmount = oeth.balanceOf(address(safeContract)) - oethAmount;

        // Redeem OETH using Vault to get WETH
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.redeem.selector,
                oethAmount,
                oethAmount
            ),
            0 // Call
        );
        require(success, "Failed to redeem OETH");

        return oethAmount;
    }

    /**
     * @dev Unwraps wOETH and redeems it to get WETH, then bridges it to Plume.
     * @param woethAmount Amount of wOETH to unwrap.
     * @param slippageBps Bridge slippage in 10^4 basis points.
     */
    function unwrapRedeemAndBridgeToPlume(
        uint256 woethAmount,
        uint256 slippageBps
    ) external payable onlyOperator {
        uint256 wethAmount = _unwrapAndRedeem(woethAmount);
        // Unwrap into ETH
        safeContract.execTransactionFromModule(
            address(weth),
            0, // Value
            abi.encodeWithSelector(weth.withdraw.selector, wethAmount),
            0 // Call
        );

        bridgeWETHToPlume(wethAmount, slippageBps);
    }
}
