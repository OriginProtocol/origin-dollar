// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title CrossChainRemoteStrategy
 * @author Origin Protocol Inc
 *
 * @dev Part of the cross-chain strategy that lives on the remote chain.
 *      Handles deposits and withdrawals from the master strategy on peer chain
 *      and locally deposits the funds to a 4626 compatible vault.
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { Generalized4626Strategy } from "../Generalized4626Strategy.sol";
import { AbstractCCTPIntegrator } from "./AbstractCCTPIntegrator.sol";
import { CrossChainStrategyHelper } from "./CrossChainStrategyHelper.sol";
import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { Strategizable } from "../../governance/Strategizable.sol";

contract CrossChainRemoteStrategy is
    AbstractCCTPIntegrator,
    Generalized4626Strategy,
    Strategizable
{
    using SafeERC20 for IERC20;
    using CrossChainStrategyHelper for bytes;

    event DepositUnderlyingFailed(string reason);
    event WithdrawalFailed(uint256 amountRequested, uint256 amountAvailable);
    event WithdrawUnderlyingFailed(string reason);

    modifier onlyOperatorOrStrategistOrGovernor() {
        require(
            msg.sender == operator ||
                msg.sender == strategistAddr ||
                isGovernor(),
            "Caller is not the Operator, Strategist or the Governor"
        );
        _;
    }

    modifier onlyGovernorOrStrategist()
        override(InitializableAbstractStrategy, Strategizable) {
        require(
            msg.sender == strategistAddr || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        AbstractCCTPIntegrator(_cctpConfig)
        Generalized4626Strategy(_baseConfig, _cctpConfig.usdcToken)
    {
        require(usdcToken == address(assetToken), "Token mismatch");
        require(
            _baseConfig.platformAddress != address(0),
            "Invalid platform address"
        );
        // Vault address must always be address(0) for the remote strategy
        require(
            _baseConfig.vaultAddress == address(0),
            "Invalid vault address"
        );
    }

    /**
     * @dev Initialize the strategy implementation
     * @param _strategist Address of the strategist
     * @param _operator Address of the operator
     * @param _minFinalityThreshold Minimum finality threshold
     * @param _feePremiumBps Fee premium in basis points
     */
    function initialize(
        address _strategist,
        address _operator,
        uint16 _minFinalityThreshold,
        uint16 _feePremiumBps
    ) external virtual onlyGovernor initializer {
        _initialize(_operator, _minFinalityThreshold, _feePremiumBps);
        _setStrategistAddr(_strategist);

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);

        assets[0] = address(usdcToken);
        pTokens[0] = address(platformAddress);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    /// @inheritdoc Generalized4626Strategy
    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
        onlyGovernorOrStrategist
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /// @inheritdoc Generalized4626Strategy
    function depositAll()
        external
        virtual
        override
        onlyGovernorOrStrategist
        nonReentrant
    {
        _deposit(usdcToken, IERC20(usdcToken).balanceOf(address(this)));
    }

    /// @inheritdoc Generalized4626Strategy
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual override onlyGovernorOrStrategist nonReentrant {
        _withdraw(_recipient, _asset, _amount);
    }

    /// @inheritdoc Generalized4626Strategy
    function withdrawAll()
        external
        virtual
        override
        onlyGovernorOrStrategist
        nonReentrant
    {
        IERC4626 platform = IERC4626(platformAddress);
        _withdraw(
            address(this),
            usdcToken,
            platform.previewRedeem(platform.balanceOf(address(this)))
        );
    }

    /// @inheritdoc AbstractCCTPIntegrator
    function _onMessageReceived(bytes memory payload) internal override {
        uint32 messageType = payload.getMessageType();
        if (messageType == CrossChainStrategyHelper.DEPOSIT_MESSAGE) {
            // Received when Master strategy sends tokens to the remote strategy
            // Do nothing because we receive acknowledgement with token transfer,
            // so _onTokenReceived will handle it
        } else if (messageType == CrossChainStrategyHelper.WITHDRAW_MESSAGE) {
            // Received when Master strategy requests a withdrawal
            _processWithdrawMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    /**
     * @dev Process deposit message from peer strategy
     * @param tokenAmount Amount of tokens received
     * @param feeExecuted Fee executed
     * @param payload Payload of the message
     */
    function _processDepositMessage(
        // solhint-disable-next-line no-unused-vars
        uint256 tokenAmount,
        // solhint-disable-next-line no-unused-vars
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual {
        (uint64 nonce, ) = payload.decodeDepositMessage();

        // Replay protection is part of the _markNonceAsProcessed function
        _markNonceAsProcessed(nonce);

        // Deposit everything we got, not just what was bridged
        uint256 balance = IERC20(usdcToken).balanceOf(address(this));

        // Underlying call to deposit funds can fail. It mustn't affect the overall
        // flow as confirmation message should still be sent.
        if (balance >= 1e6) {
            _deposit(usdcToken, balance);
        }

        // Send balance check message to the peer strategy
        bytes memory message = CrossChainStrategyHelper
            .encodeBalanceCheckMessage(
                lastTransferNonce,
                checkBalance(usdcToken),
                true
            );
        _sendMessage(message);
    }

    /**
     * @dev Deposit assets by converting them to shares
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal override {
        // By design, this function should not revert. Otherwise, it'd
        // not be able to process messages and might freeze the contracts
        // state. However these two require statements would never fail
        // in every function invoking this. The same kind of checks should
        // be enforced in all the calling functions for these two and any
        // other require statements added to this function.
        require(_amount > 0, "Must deposit something");
        require(_asset == address(usdcToken), "Unexpected asset address");

        // This call can fail, and the failure doesn't need to bubble up to the _processDepositMessage function
        // as the flow is not affected by the failure.

        try IERC4626(platformAddress).deposit(_amount, address(this)) {
            emit Deposit(_asset, address(shareToken), _amount);
        } catch Error(string memory reason) {
            emit DepositUnderlyingFailed(
                string(abi.encodePacked("Deposit failed: ", reason))
            );
        } catch (bytes memory lowLevelData) {
            emit DepositUnderlyingFailed(
                string(
                    abi.encodePacked(
                        "Deposit failed: low-level call failed with data ",
                        lowLevelData
                    )
                )
            );
        }
    }

    /**
     * @dev Process withdrawal message from peer strategy
     * @param payload Payload of the message
     */
    function _processWithdrawMessage(bytes memory payload) internal virtual {
        (uint64 nonce, uint256 withdrawAmount) = payload
            .decodeWithdrawMessage();

        // Replay protection is part of the _markNonceAsProcessed function
        _markNonceAsProcessed(nonce);

        uint256 usdcBalance = IERC20(usdcToken).balanceOf(address(this));

        if (usdcBalance < withdrawAmount) {
            // Withdraw the missing funds from the remote strategy. This call can fail and
            // the failure doesn't bubble up to the _processWithdrawMessage function
            _withdraw(address(this), usdcToken, withdrawAmount - usdcBalance);

            // Update the possible increase in the balance on the contract.
            usdcBalance = IERC20(usdcToken).balanceOf(address(this));
        }

        // Check balance after withdrawal
        uint256 strategyBalance = checkBalance(usdcToken);

        // If there are some tokens to be sent AND the balance is sufficient
        // to satisfy the withdrawal request then send the funds to the peer strategy.
        // In case a direct withdraw(All) has previously been called
        // there is a possibility of USDC funds remaining on the contract.
        // A separate withdraw to extract or deposit to the Morpho vault needs to be
        // initiated from the peer Master strategy to utilise USDC funds.
        if (withdrawAmount >= 1e6 && usdcBalance >= withdrawAmount) {
            // The new balance on the contract needs to have USDC subtracted from it as
            // that will be withdrawn in the next step
            bytes memory message = CrossChainStrategyHelper
                .encodeBalanceCheckMessage(
                    lastTransferNonce,
                    strategyBalance - withdrawAmount,
                    true
                );
            _sendTokens(withdrawAmount, message);
        } else {
            // Contract either:
            // - only has small dust amount of USDC
            // - doesn't have sufficient funds to satisfy the withdrawal request
            // In both cases send the balance update message to the peer strategy.
            bytes memory message = CrossChainStrategyHelper
                .encodeBalanceCheckMessage(
                    lastTransferNonce,
                    strategyBalance,
                    true
                );
            _sendMessage(message);
            emit WithdrawalFailed(withdrawAmount, usdcBalance);
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
        require(_recipient == address(this), "Invalid recipient");
        require(_asset == address(usdcToken), "Unexpected asset address");

        // This call can fail, and the failure doesn't need to bubble up to the _processWithdrawMessage function
        // as the flow is not affected by the failure.
        try
            // slither-disable-next-line unused-return
            IERC4626(platformAddress).withdraw(
                _amount,
                address(this),
                address(this)
            )
        {
            emit Withdrawal(_asset, address(shareToken), _amount);
        } catch Error(string memory reason) {
            emit WithdrawUnderlyingFailed(
                string(abi.encodePacked("Withdrawal failed: ", reason))
            );
        } catch (bytes memory lowLevelData) {
            emit WithdrawUnderlyingFailed(
                string(
                    abi.encodePacked(
                        "Withdrawal failed: low-level call failed with data ",
                        lowLevelData
                    )
                )
            );
        }
    }

    /**
     * @dev Process token received message from peer strategy
     * @param tokenAmount Amount of tokens received
     * @param feeExecuted Fee executed
     * @param payload Payload of the message
     */
    function _onTokenReceived(
        uint256 tokenAmount,
        uint256 feeExecuted,
        bytes memory payload
    ) internal override {
        uint32 messageType = payload.getMessageType();

        require(
            messageType == CrossChainStrategyHelper.DEPOSIT_MESSAGE,
            "Invalid message type"
        );

        _processDepositMessage(tokenAmount, feeExecuted, payload);
    }

    /**
     * @dev Send balance update message to the peer strategy
     */
    function sendBalanceUpdate()
        external
        virtual
        onlyOperatorOrStrategistOrGovernor
    {
        uint256 balance = checkBalance(usdcToken);
        bytes memory message = CrossChainStrategyHelper
            .encodeBalanceCheckMessage(lastTransferNonce, balance, false);
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
        returns (uint256)
    {
        require(_asset == usdcToken, "Unexpected asset address");
        /**
         * Balance of USDC on the contract is counted towards the total balance, since a deposit
         * to the Morpho V2 might fail and the USDC might remain on this contract as a result of a
         * bridged transfer.
         */
        uint256 balanceOnContract = IERC20(usdcToken).balanceOf(address(this));

        IERC4626 platform = IERC4626(platformAddress);
        return
            platform.previewRedeem(platform.balanceOf(address(this))) +
            balanceOnContract;
    }
}
