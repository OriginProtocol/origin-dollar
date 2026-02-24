// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// solhint-disable-next-line max-line-length
import { AbstractCCIPBridgeHelperModule, AbstractSafeModule, IRouterClient } from "./AbstractCCIPBridgeHelperModule.sol";

import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IVault } from "../interfaces/IVault.sol";

import { BridgedWOETHStrategy } from "../strategies/BridgedWOETHStrategy.sol";

contract BaseBridgeHelperModule is
    AccessControlEnumerable,
    AbstractCCIPBridgeHelperModule
{
    IVault public constant vault =
        IVault(0x98a0CbeF61bD2D21435f433bE4CD42B56B38CC93);
    IWETH9 public constant weth =
        IWETH9(0x4200000000000000000000000000000000000006);
    IERC20 public constant oethb =
        IERC20(0xDBFeFD2e8460a6Ee4955A68582F85708BAEA60A3);
    IERC4626 public constant bridgedWOETH =
        IERC4626(0xD8724322f44E5c58D7A815F542036fb17DbbF839);

    BridgedWOETHStrategy public constant bridgedWOETHStrategy =
        BridgedWOETHStrategy(0x80c864704DD06C3693ed5179190786EE38ACf835);

    IRouterClient public constant CCIP_ROUTER =
        IRouterClient(0x881e3A65B4d4a04dD529061dd0071cf975F58bCD);

    uint64 public constant CCIP_ETHEREUM_CHAIN_SELECTOR = 5009297550715157269;

    constructor(address _safeContract) AbstractSafeModule(_safeContract) {}

    /**
     * @dev Bridges wOETH to Ethereum.
     * @param woethAmount Amount of wOETH to bridge.
     */
    function bridgeWOETHToEthereum(uint256 woethAmount)
        public
        payable
        onlyOperator
    {
        _bridgeTokenWithCCIP(
            CCIP_ROUTER,
            CCIP_ETHEREUM_CHAIN_SELECTOR,
            IERC20(address(bridgedWOETH)),
            woethAmount
        );
    }

    /**
     * @dev Bridges WETH to Ethereum.
     * @param wethAmount Amount of WETH to bridge.
     */
    function bridgeWETHToEthereum(uint256 wethAmount)
        public
        payable
        onlyOperator
    {
        _bridgeTokenWithCCIP(
            CCIP_ROUTER,
            CCIP_ETHEREUM_CHAIN_SELECTOR,
            IERC20(address(weth)),
            wethAmount
        );
    }

    /**
     * @dev Deposits wOETH into the bridgedWOETH strategy.
     * @param woethAmount Amount of wOETH to deposit.
     * @param requestWithdrawal Whether to request an async withdrawal of the
     *        resulting OETHb from the Vault.
     * @return requestId The withdrawal request ID (0 if not requested).
     * @return oethbAmount Amount of OETHb received or queued for withdrawal.
     */
    function depositWOETH(uint256 woethAmount, bool requestWithdrawal)
        external
        onlyOperator
        returns (uint256 requestId, uint256 oethbAmount)
    {
        oethbAmount = _depositWOETH(woethAmount);
        if (requestWithdrawal) {
            requestId = _requestWithdrawal(oethbAmount);
        }
    }

    /**
     * @dev Claims a previously requested withdrawal and bridges WETH to Ethereum.
     * @param requestId The withdrawal request ID to claim.
     */
    function claimAndBridgeWETH(uint256 requestId)
        external
        payable
        onlyOperator
    {
        uint256 wethAmount = _claimWithdrawal(requestId);
        bridgeWETHToEthereum(wethAmount);
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
     * @dev Deposits wOETH into the bridgedWOETH strategy.
     * @param woethAmount Amount of wOETH to deposit.
     * @return oethbAmount Amount of OETHb received.
     */
    function _depositWOETH(uint256 woethAmount)
        internal
        returns (uint256 oethbAmount)
    {
        // Update oracle price
        bridgedWOETHStrategy.updateWOETHOraclePrice();

        // Rebase to account for any yields from price update
        vault.rebase();

        oethbAmount = oethb.balanceOf(address(safeContract));

        // Approve bridgedWOETH strategy to move wOETH
        bool success = safeContract.execTransactionFromModule(
            address(bridgedWOETH),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETH.approve.selector,
                address(bridgedWOETHStrategy),
                woethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve wOETH");

        // Deposit to bridgedWOETH strategy
        success = safeContract.execTransactionFromModule(
            address(bridgedWOETHStrategy),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETHStrategy.depositBridgedWOETH.selector,
                woethAmount
            ),
            0 // Call
        );
        require(success, "Failed to deposit bridged WOETH");

        oethbAmount = oethb.balanceOf(address(safeContract)) - oethbAmount;

        // Rebase to account for any yields from price update
        // and backing asset change from deposit
        vault.rebase();
    }

    /**
     * @dev Requests an async withdrawal from the Vault.
     * @param oethbAmount Amount of OETHb to withdraw.
     * @return requestId The withdrawal request ID.
     */
    function _requestWithdrawal(uint256 oethbAmount)
        internal
        returns (uint256 requestId)
    {
        // Read the next withdrawal index before requesting
        // (safe because requestWithdrawal is nonReentrant)
        requestId = vault.withdrawalQueueMetadata().nextWithdrawalIndex;

        bool success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(
                vault.requestWithdrawal.selector,
                oethbAmount
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

    /**
     * @dev Deposits WETH into the Vault and redeems wOETH from the bridgedWOETH strategy.
     * @param wethAmount Amount of WETH to deposit.
     * @return Amount of wOETH received.
     */
    function depositWETHAndRedeemWOETH(uint256 wethAmount)
        external
        onlyOperator
        returns (uint256)
    {
        return _withdrawWOETH(wethAmount);
    }

    function depositWETHAndBridgeWOETH(uint256 wethAmount)
        external
        onlyOperator
        returns (uint256)
    {
        uint256 woethAmount = _withdrawWOETH(wethAmount);
        bridgeWOETHToEthereum(woethAmount);
        return woethAmount;
    }

    /**
     * @dev Withdraws wOETH from the bridgedWOETH strategy.
     * @param wethAmount Amount of WETH to use to withdraw.
     * @return Amount of wOETH received.
     */
    function _withdrawWOETH(uint256 wethAmount) internal returns (uint256) {
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

        // Mint OETHb with WETH
        success = safeContract.execTransactionFromModule(
            address(vault),
            0, // Value
            abi.encodeWithSelector(vault.mint.selector, wethAmount),
            0 // Call
        );
        require(success, "Failed to mint OETHb");

        // Approve bridgedWOETH strategy to move OETHb
        success = safeContract.execTransactionFromModule(
            address(oethb),
            0, // Value
            abi.encodeWithSelector(
                oethb.approve.selector,
                address(bridgedWOETHStrategy),
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to approve OETHb");

        uint256 woethAmount = bridgedWOETH.balanceOf(address(safeContract));

        // Withdraw from bridgedWOETH strategy
        success = safeContract.execTransactionFromModule(
            address(bridgedWOETHStrategy),
            0, // Value
            abi.encodeWithSelector(
                bridgedWOETHStrategy.withdrawBridgedWOETH.selector,
                wethAmount
            ),
            0 // Call
        );
        require(success, "Failed to withdraw bridged WOETH");

        woethAmount =
            bridgedWOETH.balanceOf(address(safeContract)) -
            woethAmount;

        return woethAmount;
    }
}
