// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy - the Mainnet part
 * @author Origin Protocol Inc
 * 
 * @dev This strategy can only perform 1 deposit or withdrawal at a time. For that 
 *      reason it shouldn't be configured as an asset default strategy.
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { AbstractCCTPMorphoStrategy } from "./AbstractCCTPMorphoStrategy.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

contract CrossChainMasterStrategy is
    InitializableAbstractStrategy,
    AbstractCCTPMorphoStrategy
{
    using SafeERC20 for IERC20;

    // Remote strategy balance
    uint256 public remoteStrategyBalance;

    // Amount that's bridged but not yet received on the destination chain
    uint256 public pendingAmount;

    // Transfer amounts by nonce
    mapping(uint64 => uint256) public transferAmounts;

    /**
     * @param _stratConfig The platform and OToken vault addresses
     */
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        AbstractCCTPMorphoStrategy(
            _cctpConfig
        )
    {}

    // /**
    //  * @dev Returns the address of the Remote part of the strategy on L2
    //  */
    // function remoteAddress() internal virtual returns (address) {
    //     return address(this);
    // }

    /**
     * @dev Deposit asset into mainnet strategy making them ready to be
     *      bridged to Remote part of the strategy
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit the entire balance
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        if (balance > 0) {
            _deposit(baseToken, balance);
        }
    }

    /**
     * @dev Send a withdrawal Wormhole message requesting a certain withdrawal amount
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_recipient == vaultAddress, "Only Vault can withdraw");

        _withdraw(_asset, _recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        _withdraw(baseToken, vaultAddress, balance);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == baseToken, "Unsupported asset");

        // USDC balance on this contract
        // + USDC being bridged
        // + USDC cached in the corresponding Remote part of this contract
        uint256 undepositedUSDC = IERC20(baseToken).balanceOf(address(this));
        return undepositedUSDC + pendingAmount + remoteStrategyBalance;
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {}

    /**
     * @dev
     * @param _asset Address of the asset to approve
     * @param _aToken Address of the aToken
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _aToken)
        internal
        override
    {}

    /**
     * @dev
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {}

    function _onMessageReceived(bytes memory payload) internal override {
        uint32 messageType = _getMessageType(payload);
        if (messageType == DEPOSIT_ACK_MESSAGE) {
            // Received when Remote strategy acknowledges the deposit
            _processDepositAckMessage(payload);
        } else if (messageType == BALANCE_CHECK_MESSAGE) {
            // Received when Remote strategy checks the balance
            _processBalanceCheckMessage(payload);
        } else if (messageType == WITHDRAW_ACK_MESSAGE) {
            // Received when Remote strategy acknowledges the withdrawal
            // Do nothing because we receive acknowledgement with token transfer, so _onTokenReceived will handle it
            // TODO: Should _onTokenReceived always call _onMessageReceived?
            // _processWithdrawAckMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        // Received when Remote strategy sends tokens to the master strategy
        uint32 messageType = _getMessageType(payload);
        // Only withdraw acknowledgements are expected here
        require(messageType == WITHDRAW_ACK_MESSAGE, "Invalid message type");

        _processWithdrawAckMessage(tokenAmount, feeExecuted, payload);
    }

    function _deposit(address _asset, uint256 depositAmount) internal virtual {
        require(_asset == baseToken, "Unsupported asset");

        uint64 nonce = _getNextNonce();

        require(depositAmount > 0, "Deposit amount must be greater than 0");
        require(
            depositAmount <= MAX_TRANSFER_AMOUNT,
            "Deposit amount exceeds max transfer amount"
        );

        emit Deposit(_asset, _asset, depositAmount);

        transferAmounts[nonce] = depositAmount;

        // Add to pending amount
        // TODO: make sure overflow doesn't happen here (it shouldn't because of 0.8.0 but still make sure)
        pendingAmount = pendingAmount + depositAmount;

        // Send deposit message with payload
        bytes memory message = _encodeDepositMessage(nonce, depositAmount);
        _sendTokens(depositAmount, message);
    }

    function _processDepositAckMessage(bytes memory message) internal virtual {
        (
            uint64 nonce,
            uint256 amountReceived,
            uint256 feeExecuted,
            uint256 balanceAfter
        ) = _decodeDepositAckMessage(message);

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // TODO: Do we need any tolerance here?
        require(
            transferAmounts[nonce] == amountReceived + feeExecuted,
            "Transfer amount mismatch"
        );

        // Subtract from pending amount
        pendingAmount = pendingAmount - amountReceived;

        // Update balance
        remoteStrategyBalance = balanceAfter;
    }

    function _withdraw(
        address _asset,
        address _recipient,
        uint256 _amount
    ) internal virtual {
        require(_asset == baseToken, "Unsupported asset");
        require(_amount > 0, "Withdraw amount must be greater than 0");
        require(_recipient == vaultAddress, "Only Vault can withdraw");

        require(
            _amount <= MAX_TRANSFER_AMOUNT,
            "Withdraw amount exceeds max transfer amount"
        );

        uint64 nonce = _getNextNonce();

        emit Withdrawal(baseToken, baseToken, _amount);

        transferAmounts[nonce] = _amount;

        // Send withdrawal message with payload
        bytes memory message = _encodeWithdrawMessage(nonce, _amount);
        _sendMessage(message);
    }

    function _processWithdrawAckMessage(
        uint256 tokenAmount,
        // solhint-disable-next-line no-unused-vars
        uint256 feeExecuted,
        bytes memory message
    ) internal virtual {
        (
            uint64 nonce,
            uint256 amountSent,
            uint256 balanceAfter
        ) = _decodeWithdrawAckMessage(message);

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        require(
            transferAmounts[nonce] == amountSent,
            "Transfer amount mismatch"
        );

        // Update balance
        remoteStrategyBalance = balanceAfter;

        // Transfer tokens to vault
        IERC20(baseToken).safeTransfer(vaultAddress, tokenAmount);
    }

    function _processBalanceCheckMessage(bytes memory message)
        internal
        virtual
    {
        (uint64 nonce, uint256 balance) = _decodeBalanceCheckMessage(message);

        uint64 _lastNonce = lastTransferNonce;

        if (_lastNonce != nonce || !isNonceProcessed(_lastNonce)) {
            // Do not update pending amount if the nonce is not the latest one
            return;
        }

        // Update balance
        remoteStrategyBalance = balance;
    }
}
