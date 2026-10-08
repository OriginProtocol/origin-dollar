// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// solhint-disable-next-line max-line-length
import { AbstractCCIPBridgeHelperModule, AbstractSafeModule, IRouterClient } from "./AbstractCCIPBridgeHelperModule.sol";

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

contract EthereumBridgeHelperModule is
    AccessControlEnumerable,
    AbstractCCIPBridgeHelperModule
{
    IVault public constant vault =
        IVault(0x39254033945AA2E4809Cc2977E7087BEE48bd7Ab);
    IWETH9 public constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 public constant oeth =
        IERC20(0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3);
    IERC4626 public constant woeth =
        IERC4626(0xDcEe70654261AF21C44c093C300eD3Bb97b78192);

    IRouterClient public constant CCIP_ROUTER =
        IRouterClient(0x80226fc0Ee2b096224EeAc085Bb9a8cba1146f7D);

    uint64 public constant CCIP_BASE_CHAIN_SELECTOR = 15971525489660198786;

    constructor(address _safeContract) AbstractSafeModule(_safeContract) {}

    /**
     * @dev Bridges wOETH to Base using CCIP.
     * @param woethAmount Amount of wOETH to bridge.
     */
    function bridgeWOETHToBase(uint256 woethAmount)
        public
        payable
        onlyOperator
    {
        _bridgeTokenWithCCIP(
            CCIP_ROUTER,
            CCIP_BASE_CHAIN_SELECTOR,
            woeth,
            woethAmount
        );
    }

    /**
     * @dev Bridges wETH to Base using CCIP.
     * @param wethAmount Amount of wETH to bridge.
     */
    function bridgeWETHToBase(uint256 wethAmount) public payable onlyOperator {
        _bridgeTokenWithCCIP(
            CCIP_ROUTER,
            CCIP_BASE_CHAIN_SELECTOR,
            IERC20(address(weth)),
            wethAmount
        );
    }

    /**
     * @dev Mints OETH and wraps it into wOETH.
     * @param wethAmount Amount of WETH to mint.
     * @param useNativeToken Whether to use native token to mint.
     * @return Amount of wOETH minted.
     */
    function mintAndWrap(uint256 wethAmount, bool useNativeToken)
        external
        onlyOperator
        returns (uint256)
    {
        if (useNativeToken) {
            wrapETH(wethAmount);
        }

        return _mintAndWrap(wethAmount);
    }

    function wrapETH(uint256 ethAmount) public payable onlyOperator {
        // Deposit ETH into WETH
        safeContract.execTransactionFromModule(
            address(weth),
            ethAmount, // Value
            abi.encodeWithSelector(weth.deposit.selector),
            0 // Call
        );
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
            abi.encodeWithSelector(vault.mint.selector, wethAmount),
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
     * @dev Mints OETH and wraps it into wOETH, then bridges it to Base using CCIP.
     * @param wethAmount Amount of WETH to mint.
     * @param useNativeToken Whether to use native token to mint.
     */
    function mintWrapAndBridgeToBase(uint256 wethAmount, bool useNativeToken)
        external
        payable
        onlyOperator
    {
        if (useNativeToken) {
            wrapETH(wethAmount);
        }

        uint256 woethAmount = _mintAndWrap(wethAmount);
        bridgeWOETHToBase(woethAmount);
    }

    /**
     * @dev Unwraps wOETH and requests an async withdrawal from the Vault.
     * @param woethAmount Amount of wOETH to unwrap.
     * @return requestId The withdrawal request ID.
     * @return oethAmount Amount of OETH queued for withdrawal.
     */
    function unwrapAndRequestWithdrawal(uint256 woethAmount)
        external
        onlyOperator
        returns (uint256 requestId, uint256 oethAmount)
    {
        return _unwrapAndRequestWithdrawal(woethAmount);
    }

    /**
     * @dev Claims a previously requested withdrawal and bridges WETH to Base.
     * @param requestId The withdrawal request ID to claim.
     */
    function claimAndBridgeToBase(uint256 requestId)
        external
        payable
        onlyOperator
    {
        uint256 wethAmount = _claimWithdrawal(requestId);
        bridgeWETHToBase(wethAmount);
    }

    /**
     * @dev Claims a previously requested withdrawal.
     * @param requestId The withdrawal request ID to claim.
     * @return wethAmount Amount of WETH received.
     */
    function claimWithdrawal(uint256 requestId)
        external
        onlyOperator
        returns (uint256 wethAmount)
    {
        return _claimWithdrawal(requestId);
    }

    /**
     * @dev Unwraps wOETH and requests an async withdrawal from the Vault.
     * @param woethAmount Amount of wOETH to unwrap.
     * @return requestId The withdrawal request ID.
     * @return oethAmount Amount of OETH queued for withdrawal.
     */
    function _unwrapAndRequestWithdrawal(uint256 woethAmount)
        internal
        returns (uint256 requestId, uint256 oethAmount)
    {
        // Read the next withdrawal index before requesting
        // (safe because requestWithdrawal is nonReentrant)
        requestId = vault.withdrawalQueueMetadata().nextWithdrawalIndex;

        oethAmount = oeth.balanceOf(address(safeContract));

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

        // Request async withdrawal from Vault
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.requestWithdrawal.selector,
                oethAmount
            ),
            0 // Call
        );
        require(success, "Failed to request withdrawal");
    }

    /**
     * @dev Claims a previously requested withdrawal from the Vault.
     * @param requestId The withdrawal request ID to claim.
     * @return wethAmount Amount of WETH received.
     */
    function _claimWithdrawal(uint256 requestId)
        internal
        returns (uint256 wethAmount)
    {
        wethAmount = weth.balanceOf(address(safeContract));

        bool success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(vault.claimWithdrawal.selector, requestId),
            0 // Call
        );
        require(success, "Failed to claim withdrawal");

        wethAmount = weth.balanceOf(address(safeContract)) - wethAmount;
    }
}
