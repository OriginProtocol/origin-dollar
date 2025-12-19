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
import { AbstractCCTP4626Strategy } from "./AbstractCCTP4626Strategy.sol";
import { BytesHelper } from "../../utils/BytesHelper.sol";

contract CrossChainMasterStrategy is
    InitializableAbstractStrategy,
    AbstractCCTP4626Strategy
{
    using SafeERC20 for IERC20;

    // Remote strategy balance
    uint256 public remoteStrategyBalance;

    // Amount that's bridged but not yet received on the destination chain
    uint256 public pendingAmount;

    enum TransferType {
        None, // To avoid using 0
        Deposit,
        Withdrawal
    }
    mapping(uint64 => TransferType) public transferTypeByNonce;

    event RemoteStrategyBalanceUpdated(uint256 balance);

    /**
     * @param _stratConfig The platform and OToken vault addresses
     */
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        AbstractCCTP4626Strategy(_cctpConfig)
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
        return _asset == baseToken;
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
        if (messageType == BALANCE_CHECK_MESSAGE) {
            // Received when Remote strategy checks the balance
            _processBalanceCheckMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    function _onTokenReceived(
        // solhint-disable-next-line no-unused-vars
        uint256 tokenAmount,
        // solhint-disable-next-line no-unused-vars
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        uint64 _nonce = lastTransferNonce;

        // Should be expecting an acknowledgement
        require(!isNonceProcessed(_nonce), "Nonce already processed");
        // Only a withdrawal can send tokens to Master strategy
        require(
            transferTypeByNonce[_nonce] == TransferType.Withdrawal,
            "Expecting withdrawal"
        );

        // Confirm receipt of tokens from Withdraw command
        _markNonceAsProcessed(_nonce);

        // Now relay to the regular flow
        // NOTE: Calling _onMessageReceived would mean that we are bypassing a
        // few checks that the regular flow does (like sourceDomainID check
        // and sender check in `handleReceiveFinalizedMessage`). However,
        // CCTPMessageRelayer relays the message first (which will go through
        // all the checks) and not update balance and then finally calls this
        // `_onTokenReceived` which will update the balance.
        // So, if any of the checks fail during the first no-balance-update flow,
        // this won't happen either, since the tx would revert.
        _onMessageReceived(payload);

        // Send any tokens in the contract to the Vault
        uint256 usdcBalance = IERC20(baseToken).balanceOf(address(this));
        // Should always have enough tokens
        require(usdcBalance >= tokenAmount, "Insufficient balance");
        IERC20(baseToken).safeTransfer(vaultAddress, tokenAmount);
    }

    function _deposit(address _asset, uint256 depositAmount) internal virtual {
        require(_asset == baseToken, "Unsupported asset");
        require(!isTransferPending(), "Transfer already pending");
        require(pendingAmount == 0, "Unexpected pending amount");
        require(depositAmount > 0, "Deposit amount must be greater than 0");
        require(
            depositAmount <= MAX_TRANSFER_AMOUNT,
            "Deposit amount exceeds max transfer amount"
        );

        uint64 nonce = _getNextNonce();
        transferTypeByNonce[nonce] = TransferType.Deposit;

        // Set pending amount
        pendingAmount = depositAmount;

        // Send deposit message with payload
        bytes memory message = _encodeDepositMessage(nonce, depositAmount);
        _sendTokens(depositAmount, message);
        emit Deposit(_asset, _asset, depositAmount);
    }

    function _withdraw(
        address _asset,
        address _recipient,
        uint256 _amount
    ) internal virtual {
        require(_asset == baseToken, "Unsupported asset");
        require(_amount > 0, "Withdraw amount must be greater than 0");
        require(_recipient == vaultAddress, "Only Vault can withdraw");
        require(!isTransferPending(), "Transfer already pending");
        require(
            _amount <= MAX_TRANSFER_AMOUNT,
            "Withdraw amount exceeds max transfer amount"
        );

        uint64 nonce = _getNextNonce();
        transferTypeByNonce[nonce] = TransferType.Withdrawal;

        emit Withdrawal(baseToken, baseToken, _amount);

        // Send withdrawal message with payload
        bytes memory message = _encodeWithdrawMessage(nonce, _amount);
        _sendMessage(message);
    }

    /**
     * @dev process balance check serves 3 purposes:
     *  - confirms a deposit to the remote strategy
     *  - confirms a withdrawal from the remote strategy
     *  - updates the remote strategy balance
     * @param message The message containing the nonce and balance
     */
    function _processBalanceCheckMessage(bytes memory message)
        internal
        virtual
    {
        (uint64 nonce, uint256 balance) = _decodeBalanceCheckMessage(message);

        uint64 _lastCachedNonce = lastTransferNonce;

        if (nonce != _lastCachedNonce) {
            // If nonce is not the last cached nonce, it is an outdated message
            // Ignore it
            return;
        }

        bool processedTransfer = isNonceProcessed(nonce);
        if (
            !processedTransfer &&
            transferTypeByNonce[nonce] == TransferType.Withdrawal
        ) {
            // Pending withdrawal is taken care of by _onTokenReceived
            // Do not update balance due to race conditions
            return;
        }

        // Update the balance always
        remoteStrategyBalance = balance;
        emit RemoteStrategyBalanceUpdated(balance);

        /**
         * A deposit is being confirmed.
         * A withdrawal will always be confirmed if it reaches this point of code.
         */
        if (!processedTransfer) {
            _markNonceAsProcessed(nonce);

            // Effect of confirming a deposit, reset pending amount
            pendingAmount = 0;

            // NOTE: Withdrawal is taken care of by _onTokenReceived
        }
    }
}
