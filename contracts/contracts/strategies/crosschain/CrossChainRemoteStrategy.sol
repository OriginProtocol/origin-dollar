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
import { AbstractCCTPIntegrator } from "./AbstractCCTPIntegrator.sol";
import { CrossChainStrategyHelper } from "./CrossChainStrategyHelper.sol";
import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

contract CrossChainRemoteStrategy is
    AbstractCCTPIntegrator,
    Generalized4626Strategy
{
    using SafeERC20 for IERC20;
    using CrossChainStrategyHelper for bytes;

    event DepositFailed(string reason);
    event WithdrawFailed(string reason);
    event StrategistUpdated(address _address);

    address public strategistAddr;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        CCTPIntegrationConfig memory _cctpConfig
    )
        AbstractCCTPIntegrator(_cctpConfig)
        Generalized4626Strategy(_baseConfig, _cctpConfig.baseToken)
    {
        // NOTE: Vault address must always be the proxy address
        // so that IVault(vaultAddress).strategistAddr()
    }

    function initialize(address _strategist, address _operator, uint32 _minFinalityThreshold, uint32 _feePremiumBps) external virtual onlyGovernor initializer {
        _initialize(_operator, _minFinalityThreshold, _feePremiumBps);
        _setStrategistAddr(_strategist);

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);

        assets[0] = address(assetToken);
        pTokens[0] = address(platformAddress);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    /**
     * @notice Set address of Strategist
     * @param _address Address of Strategist
     */
    function setStrategistAddr(address _address) external onlyGovernor {
        _setStrategistAddr(_address);
    }
    function _setStrategistAddr(address _address) internal {
        strategistAddr = _address;
        emit StrategistUpdated(_address);
    }

    // solhint-disable-next-line no-unused-vars
    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
        onlyGovernorOrStrategist
    {
        _deposit(_asset, _amount);
    }

    function depositAll() external virtual override onlyGovernorOrStrategist {
        _deposit(baseToken, IERC20(baseToken).balanceOf(address(this)));
    }

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual override onlyGovernorOrStrategist {
        _withdraw(_recipient, _asset, _amount);
    }

    function withdrawAll() external virtual override onlyGovernorOrStrategist {
        uint256 contractBalance = IERC20(baseToken).balanceOf(address(this));
        uint256 balance = checkBalance(baseToken) - contractBalance;
        _withdraw(address(this), baseToken, balance);
    }

    function _onMessageReceived(bytes memory payload) internal override {
        uint32 messageType = payload.getMessageType();
        if (messageType == CrossChainStrategyHelper.DEPOSIT_MESSAGE) {
            // // Received when Master strategy sends tokens to the remote strategy
            // Do nothing because we receive acknowledgement with token transfer, so _onTokenReceived will handle it
            // TODO: Should _onTokenReceived always call _onMessageReceived?
            // _processDepositAckMessage(payload);
        } else if (messageType == CrossChainStrategyHelper.WITHDRAW_MESSAGE) {
            // Received when Master strategy requests a withdrawal
            _processWithdrawMessage(payload);
        } else {
            revert("Unknown message type");
        }
    }

    function _processDepositMessage(
        // solhint-disable-next-line no-unused-vars
        uint256 tokenAmount,
        // solhint-disable-next-line no-unused-vars
        uint256 feeExecuted,
        bytes memory payload
    ) internal virtual {
        // TODO: no need to communicate the deposit amount if we deposit everything
        // solhint-disable-next-line no-unused-vars
        (uint64 nonce, uint256 depositAmount) = payload.decodeDepositMessage();

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Deposit everything we got
        uint256 balance = IERC20(baseToken).balanceOf(address(this));

        // Underlying call to deposit funds can fail. It mustn't affect the overall
        // flow as confirmation message should still be sent.
        _deposit(baseToken, balance);

        uint256 balanceAfter = checkBalance(baseToken);
        bytes memory message = CrossChainStrategyHelper
            .encodeBalanceCheckMessage(lastTransferNonce, balanceAfter);
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
            emit DepositFailed(
                string(abi.encodePacked("Deposit failed: ", reason))
            );
        } catch (bytes memory lowLevelData) {
            emit DepositFailed(
                string(
                    abi.encodePacked(
                        "Deposit failed: low-level call failed with data ",
                        lowLevelData
                    )
                )
            );
        }
    }

    function _processWithdrawMessage(bytes memory payload) internal virtual {
        (uint64 nonce, uint256 withdrawAmount) = payload
            .decodeWithdrawMessage();

        // Replay protection
        require(!isNonceProcessed(nonce), "Nonce already processed");
        _markNonceAsProcessed(nonce);

        // Withdraw funds from the remote strategy
        _withdraw(address(this), baseToken, withdrawAmount);

        // Check balance after withdrawal
        uint256 balanceAfter = checkBalance(baseToken);
        bytes memory message = CrossChainStrategyHelper
            .encodeBalanceCheckMessage(lastTransferNonce, balanceAfter);

        // Send the complete balance on the contract. If we were to send only the
        // withdrawn amount, the call could revert if the balance is not sufficient.
        // Or dust could be left on the contract that is hard to extract.
        uint256 usdcBalance = IERC20(baseToken).balanceOf(address(this));
        if (usdcBalance > 1e6) {
            _sendTokens(usdcBalance, message);
        } else {
            _sendMessage(message);
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
        require(_recipient != address(this), "Invalid recipient");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return

        // This call can fail, and the failure doesn't need to bubble up to the _processWithdrawMessage function
        // as the flow is not affected by the failure.
        try
            IERC4626(platformAddress).withdraw(
                _amount,
                address(this),
                address(this)
            )
        {
            emit Withdrawal(_asset, address(shareToken), _amount);
        } catch Error(string memory reason) {
            emit WithdrawFailed(
                string(abi.encodePacked("Withdrawal failed: ", reason))
            );
        } catch (bytes memory lowLevelData) {
            emit WithdrawFailed(
                string(
                    abi.encodePacked(
                        "Withdrawal failed: low-level call failed with data ",
                        lowLevelData
                    )
                )
            );
        }
    }

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

    function sendBalanceUpdate() external virtual {
        // TODO: Add permissioning
        uint256 balance = checkBalance(baseToken);
        bytes memory message = CrossChainStrategyHelper
            .encodeBalanceCheckMessage(lastTransferNonce, balance);
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
        return
            platform.previewRedeem(platform.balanceOf(address(this))) +
            balanceOnContract;
    }
}
