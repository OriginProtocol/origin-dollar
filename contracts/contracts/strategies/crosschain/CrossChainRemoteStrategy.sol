// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Remote Strategy - the L2 chain part
 * @author Origin Protocol Inc
 *
 * @dev This strategy can only perform 1 deposit or withdrawal at a time. For that 
 *      reason it shouldn't be configured as an asset default strategy.
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { Generalized4626Strategy } from "../Generalized4626Strategy.sol";
import { AbstractCCTP4626Strategy } from "./AbstractCCTP4626Strategy.sol";

contract CrossChainRemoteStrategy is
    AbstractCCTP4626Strategy,
    Generalized4626Strategy
{
    event DepositFailed(string reason);
    event WithdrawFailed(string reason);
    
    using SafeERC20 for IERC20;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        AbstractCCTP4626Strategy(
            _cctpConfig
        )
        Generalized4626Strategy(_baseConfig, _cctpConfig.baseToken)
    {}

    // solhint-disable-next-line no-unused-vars
    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
    {
        // TODO: implement this
        revert("Not implemented");
    }

    function depositAll() external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function withdraw(
        address,
        address,
        uint256
    ) external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function withdrawAll() external virtual override {
        // TODO: implement this
        revert("Not implemented");
    }

    function _onMessageReceived(bytes memory payload) internal override {
        uint32 messageType = _getMessageType(payload);
        if (messageType == DEPOSIT_MESSAGE) {
            // // Received when Master strategy sends tokens to the remote strategy
            // Do nothing because we receive acknowledgement with token transfer, so _onTokenReceived will handle it
            // TODO: Should _onTokenReceived always call _onMessageReceived?
            // _processDepositAckMessage(payload);
        } else if (messageType == WITHDRAW_MESSAGE) {
            // Received when Master strategy requests a withdrawal
            _processWithdrawMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    function _processDepositMessage(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual {
        // solhint-disable-next-line no-unused-vars
        // TODO: no need to communicate the deposit amount if we deposit everything
        (uint64 nonce, uint256 depositAmount) = _decodeDepositMessage(payload);

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Deposit everything we got
        uint256 balance = IERC20(baseToken).balanceOf(address(this));

        // Underlying call to deposit funds can fail. It mustn't affect the overall
        // flow as confirmation message should still be sent.
        _deposit(baseToken, balance);

        uint256 balanceAfter = checkBalance(baseToken);

        bytes memory message = _encodeDepositAckMessage(
            nonce,
            tokenAmount,
            feeExecuted,
            balanceAfter
        );
        _sendMessage(message);
    }

    /**
     * @dev Deposit assets by converting them to shares
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal override {
        require(_amount > 0, "Must deposit something");
        require(_asset == address(assetToken), "Unexpected asset address");

        // This call can fail, and the failure doesn't need to bubble up to the _processDepositMessage function
        // as the flow is not affected by the failure.
        try IERC4626(platformAddress).deposit(_amount, address(this)) {
            emit Deposit(_asset, address(shareToken), _amount);
        } catch Error(string memory reason) {
            emit DepositFailed(string(abi.encodePacked("Deposit failed: ", reason)));
        } catch (bytes memory lowLevelData) {
            emit DepositFailed(string(abi.encodePacked("Deposit failed: low-level call failed with data ", lowLevelData)));
        }
    }

    function _processWithdrawMessage(bytes memory payload) internal virtual {
        (uint64 nonce, uint256 withdrawAmount) = _decodeWithdrawMessage(
            payload
        );

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Withdraw funds from the remote strategy
        _withdraw(address(this), baseToken, withdrawAmount);

        // Check balance after withdrawal
        uint256 balanceAfter = checkBalance(baseToken);

        bytes memory message = _encodeWithdrawAckMessage(
            nonce,
            withdrawAmount,
            balanceAfter
        );
        // Send the complete balance on the contract. If we were to send only the
        // withdrawn amount, the call could revert if the balance is not sufficient.
        // Or dust could be left on the contract that is hard to extract.
        uint256 usdcBalance = IERC20(baseToken).balanceOf(address(this));
        if (usdcBalance > 1e6) {
            _sendTokens(usdcBalance, message);
        }
    }
    
    /**
     * @dev Withdraw asset by burning shares
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal override {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return

        // This call can fail, and the failure doesn't need to bubble up to the _processWithdrawMessage function
        // as the flow is not affected by the failure.
        try IERC4626(platformAddress).withdraw(_amount, _recipient, address(this)) {
            emit Withdrawal(_asset, address(shareToken), _amount);
        } catch Error(string memory reason) {
            emit WithdrawFailed(string(abi.encodePacked("Withdrawal failed: ", reason)));
        } catch (bytes memory lowLevelData) {
            emit WithdrawFailed(string(abi.encodePacked("Withdrawal failed: low-level call failed with data ", lowLevelData)));
        }
    }

    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        uint32 messageType = _getMessageType(payload);

        require(messageType == DEPOSIT_MESSAGE, "Invalid message type");

        _processDepositMessage(tokenAmount, feeExecuted, payload);
    }

    function sendBalanceUpdate() external virtual {
        // TODO: Add permissioning
        uint256 balance = checkBalance(baseToken);
        bytes memory message = _encodeBalanceCheckMessage(
            lastTransferNonce,
            balance
        );
        _sendMessage(message);
    }

    /**
     * @notice Get the total asset value held in the platform and contract
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform and contract
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == baseToken, "Unexpected asset address");
        /**
         * Balance of USDC on the contract is counted towards the total balance, since a deposit
         * to the Morpho V2 might fail and the USDC might remain on this contract as a result of a 
         * bridged transfer.
         */
        uint256 balanceOnContract = IERC20(baseToken).balanceOf(address(this));
        IERC4626 platform = IERC4626(platformAddress);
        return platform.previewRedeem(platform.balanceOf(address(this))) + balanceOnContract;
    }
}
