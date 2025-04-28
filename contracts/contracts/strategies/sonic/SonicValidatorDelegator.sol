// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { ISFC } from "../../interfaces/sonic/ISFC.sol";
import { IWrappedSonic } from "../../interfaces/sonic/IWrappedSonic.sol";

/**
 * @title Manages delegation to Sonic validators
 * @notice This contract implements all the required functionality to delegate to,
   undelegate from and withdraw from validators.
 * @author Origin Protocol Inc
 */
abstract contract SonicValidatorDelegator is InitializableAbstractStrategy {
    /// @notice Address of Sonic's wrapped S token
    address public immutable wrappedSonic;
    /// @notice Sonic's Special Fee Contract (SFC)
    ISFC public immutable sfc;

    /// @notice a unique ID for each withdrawal request
    uint256 public nextWithdrawId;
    /// @notice Sonic (S) that is pending withdrawal after undelegating
    uint256 public pendingWithdrawals;

    /// @notice List of supported validator IDs that can be delegated to
    uint256[] public supportedValidators;

    /// @notice Default validator id to deposit to
    uint256 public defaultValidatorId;

    struct WithdrawRequest {
        uint256 validatorId;
        uint256 undelegatedAmount;
        uint256 timestamp;
    }
    /// @notice Mapping of withdrawIds to validatorIds and undelegatedAmounts
    mapping(uint256 => WithdrawRequest) public withdrawals;

    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;

    // For future use
    uint256[44] private __gap;

    event Delegated(uint256 indexed validatorId, uint256 delegatedAmount);
    event Undelegated(
        uint256 indexed withdrawId,
        uint256 indexed validatorId,
        uint256 undelegatedAmount
    );
    event Withdrawn(
        uint256 indexed withdrawId,
        uint256 indexed validatorId,
        uint256 undelegatedAmount,
        uint256 withdrawnAmount
    );
    event RegistratorChanged(address indexed newAddress);
    event SupportedValidator(uint256 indexed validatorId);
    event UnsupportedValidator(uint256 indexed validatorId);
    event DefaultValidatorIdChanged(uint256 indexed validatorId);

    /// @dev Throws if called by any account other than the Registrator or Strategist
    modifier onlyRegistratorOrStrategist() {
        require(
            msg.sender == validatorRegistrator ||
                msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Registrator or Strategist"
        );
        _;
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wrappedSonic,
        address _sfc
    ) InitializableAbstractStrategy(_baseConfig) {
        wrappedSonic = _wrappedSonic;
        sfc = ISFC(_sfc);
    }

    function initialize() external virtual onlyGovernor initializer {
        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](1);
        address[] memory pTokens = new address[](1);

        assets[0] = address(wrappedSonic);
        pTokens[0] = address(platformAddress);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    /// @notice Returns the total value of Sonic (S) that is delegated validators.
    /// Wrapped Sonic (wS) deposits that are still to be delegated and any undelegated amounts
    /// still pending a withdrawal.
    /// @param _asset      Address of Wrapped Sonic (wS) token
    /// @return balance    Total value managed by the strategy
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(_asset == wrappedSonic, "Unsupported asset");

        // add the Wrapped Sonic (wS) in the strategy from deposits that are still to be delegated
        // and any undelegated amounts still pending a withdrawal
        balance =
            IERC20(wrappedSonic).balanceOf(address(this)) +
            pendingWithdrawals;

        // For each supported validator, get the staked amount and pending rewards
        uint256 validatorLen = supportedValidators.length;
        for (uint256 i = 0; i < validatorLen; i++) {
            uint256 validator = supportedValidators[i];
            balance += sfc.getStake(address(this), validator);
            balance += sfc.pendingRewards(address(this), validator);
        }
    }

    /**
     * @dev Delegate from this strategy to a specific Sonic validator. Called
     * automatically on asset deposit
     * @param _amount the amount of Sonic (S) to delegate.
     */
    function _delegate(uint256 _amount) internal {
        require(
            isSupportedValidator(defaultValidatorId),
            "Validator not supported"
        );

        // unwrap Wrapped Sonic (wS) to native Sonic (S)
        IWrappedSonic(wrappedSonic).withdraw(_amount);

        //slither-disable-next-line arbitrary-send-eth
        sfc.delegate{ value: _amount }(defaultValidatorId);

        emit Delegated(defaultValidatorId, _amount);
    }

    /**
     * @notice Undelegate from a specific Sonic validator.
     * This needs to be followed by a `withdrawFromSFC` two weeks later.
     * @param _validatorId The Sonic validator ID to undelegate from.
     * @param _undelegateAmount the amount of Sonic (S) to undelegate.
     * @return withdrawId The unique ID of the withdrawal request.
     */
    function undelegate(uint256 _validatorId, uint256 _undelegateAmount)
        external
        onlyRegistratorOrStrategist
        nonReentrant
        returns (uint256 withdrawId)
    {
        withdrawId = _undelegate(_validatorId, _undelegateAmount);
    }

    function _undelegate(uint256 _validatorId, uint256 _undelegateAmount)
        internal
        returns (uint256 withdrawId)
    {
        // Can still undelegate even if the validator is no longer supported
        require(_undelegateAmount > 0, "Must undelegate something");

        uint256 amountDelegated = sfc.getStake(address(this), _validatorId);
        require(
            _undelegateAmount <= amountDelegated,
            "Insufficient delegation"
        );

        withdrawId = nextWithdrawId++;

        withdrawals[withdrawId] = WithdrawRequest(
            _validatorId,
            _undelegateAmount,
            block.timestamp
        );
        pendingWithdrawals += _undelegateAmount;

        sfc.undelegate(_validatorId, withdrawId, _undelegateAmount);

        emit Undelegated(withdrawId, _validatorId, _undelegateAmount);
    }

    /**
     * @notice Withdraw native S from a previously undelegated validator.
     * The native S is wrapped wS and transferred to the Vault.
     * @param _withdrawId The unique withdraw ID used to `undelegate`
     * @return withdrawnAmount The amount of Sonic (S) withdrawn.
     * This can be less than the undelegated amount in the event of slashing.
     */
    function withdrawFromSFC(uint256 _withdrawId)
        external
        onlyRegistratorOrStrategist
        nonReentrant
        returns (uint256 withdrawnAmount)
    {
        require(_withdrawId < nextWithdrawId, "Invalid withdrawId");

        // Can still withdraw even if the validator is no longer supported
        // Load the withdrawal from storage into memory
        WithdrawRequest memory withdrawal = withdrawals[_withdrawId];
        require(!isWithdrawnFromSFC(_withdrawId), "Already withdrawn");

        withdrawals[_withdrawId].undelegatedAmount = 0;
        pendingWithdrawals -= withdrawal.undelegatedAmount;

        uint256 sBalanceBefore = address(this).balance;

        // Try to withdraw from SFC
        try sfc.withdraw(withdrawal.validatorId, _withdrawId) {
            // continue below
        } catch (bytes memory err) {
            bytes4 errorSelector = bytes4(err);

            // If the validator has been fully slashed, SFC's withdraw function will
            // revert with a StakeIsFullySlashed custom error.
            if (errorSelector == ISFC.StakeIsFullySlashed.selector) {
                // The validator was fully slashed, so all the delegated amounts were lost.
                // Will swallow the error as we still want to update the
                // withdrawals and pendingWithdrawals storage variables.

                // The return param defaults to zero but lets set it explicitly so it's clear
                withdrawnAmount = 0;

                emit Withdrawn(
                    _withdrawId,
                    withdrawal.validatorId,
                    withdrawal.undelegatedAmount,
                    withdrawnAmount
                );

                // Exit here as there is nothing to transfer to the Vault
                return withdrawnAmount;
            } else {
                // Bubble up any other SFC custom errors.
                // Inline assembly is currently the only way to generically rethrow the exact same custom error
                // from the raw bytes err in a catch block while preserving its original selector and parameters.
                // solhint-disable-next-line no-inline-assembly
                assembly {
                    revert(add(32, err), mload(err))
                }
            }
        }

        // Set return parameter
        withdrawnAmount = address(this).balance - sBalanceBefore;

        // Wrap Sonic (S) to Wrapped Sonic (wS)
        IWrappedSonic(wrappedSonic).deposit{ value: withdrawnAmount }();

        // Transfer the Wrapped Sonic (wS) to the Vault
        _withdraw(vaultAddress, wrappedSonic, withdrawnAmount);

        // withdrawal.undelegatedAmount & withdrawnAmount can differ in case of slashing
        emit Withdrawn(
            _withdrawId,
            withdrawal.validatorId,
            withdrawal.undelegatedAmount,
            withdrawnAmount
        );
    }

    /// @notice returns a bool whether a withdrawalId has already been withdrawn or not
    /// @param _withdrawId The unique withdraw ID used to `undelegate`
    function isWithdrawnFromSFC(uint256 _withdrawId)
        public
        view
        returns (bool)
    {
        WithdrawRequest memory withdrawal = withdrawals[_withdrawId];
        require(withdrawal.validatorId > 0, "Invalid withdrawId");
        return withdrawal.undelegatedAmount == 0;
    }

    /**
     * @notice Restake any pending validator rewards for all supported validators
     * @param _validatorIds List of Sonic validator IDs to restake rewards
     */
    function restakeRewards(uint256[] calldata _validatorIds)
        external
        nonReentrant
    {
        for (uint256 i = 0; i < _validatorIds.length; ++i) {
            require(
                isSupportedValidator(_validatorIds[i]),
                "Validator not supported"
            );

            uint256 rewards = sfc.pendingRewards(
                address(this),
                _validatorIds[i]
            );

            if (rewards > 0) {
                sfc.restakeRewards(_validatorIds[i]);
            }
        }

        // The SFC contract will emit Delegated and RestakedRewards events.
        // The checkBalance function should not change as the pending rewards will moved to the staked amount.
    }

    /**
     * @notice Claim any pending rewards from validators
     * @param _validatorIds List of Sonic validator IDs to claim rewards
     */
    function collectRewards(uint256[] calldata _validatorIds)
        external
        onlyRegistratorOrStrategist
        nonReentrant
    {
        uint256 sBalanceBefore = address(this).balance;

        for (uint256 i = 0; i < _validatorIds.length; ++i) {
            uint256 rewards = sfc.pendingRewards(
                address(this),
                _validatorIds[i]
            );

            if (rewards > 0) {
                // The SFC contract will emit ClaimedRewards(delegator (this), validatorId, rewards)
                sfc.claimRewards(_validatorIds[i]);
            }
        }

        uint256 rewardsAmount = address(this).balance - sBalanceBefore;

        // Wrap Sonic (S) to Wrapped Sonic (wS)
        IWrappedSonic(wrappedSonic).deposit{ value: rewardsAmount }();

        // Transfer the Wrapped Sonic (wS) to the Vault
        _withdraw(vaultAddress, wrappedSonic, rewardsAmount);
    }

    /**
     * @notice To receive native S from SFC and Wrapped Sonic (wS)
     *
     * @dev This does not prevent donating S tokens to the contract
     * as wrappedSonic has a `withdrawTo` function where a third party
     * owner of wrappedSonic can withdraw to this contract.
     */
    receive() external payable {
        require(
            msg.sender == address(sfc) || msg.sender == wrappedSonic,
            "S not from allowed contracts"
        );
    }

    /***************************************
                Admin functions
    ****************************************/

    /// @notice Set the address of the Registrator which can undelegate, withdraw and collect rewards
    /// @param _validatorRegistrator The address of the Registrator
    function setRegistrator(address _validatorRegistrator)
        external
        onlyGovernor
    {
        validatorRegistrator = _validatorRegistrator;
        emit RegistratorChanged(_validatorRegistrator);
    }

    /// @notice Set the default validatorId to delegate to on deposit
    /// @param _validatorId The validator identifier. eg 18
    function setDefaultValidatorId(uint256 _validatorId)
        external
        onlyRegistratorOrStrategist
    {
        require(isSupportedValidator(_validatorId), "Validator not supported");
        defaultValidatorId = _validatorId;
        emit DefaultValidatorIdChanged(_validatorId);
    }

    /// @notice Allows a validator to be delegated to by the Registrator
    /// @param _validatorId The validator identifier. eg 18
    function supportValidator(uint256 _validatorId) external onlyGovernor {
        require(
            !isSupportedValidator(_validatorId),
            "Validator already supported"
        );

        supportedValidators.push(_validatorId);

        emit SupportedValidator(_validatorId);
    }

    /// @notice Removes a validator from the supported list.
    /// Unsupported validators can still be undelegated from, withdrawn from and rewards collected.
    /// @param _validatorId The validator identifier. eg 18
    function unsupportValidator(uint256 _validatorId) external onlyGovernor {
        require(isSupportedValidator(_validatorId), "Validator not supported");

        uint256 validatorLen = supportedValidators.length;
        for (uint256 i = 0; i < validatorLen; ++i) {
            if (supportedValidators[i] == _validatorId) {
                supportedValidators[i] = supportedValidators[validatorLen - 1];
                supportedValidators.pop();
                break;
            }
        }

        uint256 stake = sfc.getStake(address(this), _validatorId);

        // undelegate if validator still has funds staked
        if (stake > 0) {
            _undelegate(_validatorId, stake);
        }
        emit UnsupportedValidator(_validatorId);
    }

    /// @notice Returns the length of the supportedValidators array
    function supportedValidatorsLength() external view returns (uint256) {
        return supportedValidators.length;
    }

    /// @notice Returns whether a validator is supported by this strategy
    /// @param _validatorId The validator identifier
    function isSupportedValidator(uint256 _validatorId)
        public
        view
        returns (bool)
    {
        uint256 validatorLen = supportedValidators.length;
        for (uint256 i = 0; i < validatorLen; ++i) {
            if (supportedValidators[i] == _validatorId) {
                return true;
            }
        }
        return false;
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal virtual;
}
