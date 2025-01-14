// SPDX-License-Identifier: MIT
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
        uint256 withdrawId,
        uint256 validatorId,
        uint256 undelegatedAmount
    );
    event Withdrawn(
        uint256 withdrawId,
        uint256 validatorId,
        uint256 undelegatedAmount,
        uint256 withdrawnAmount
    );
    event RegistratorChanged(address indexed newAddress);
    event SupportedValidator(uint256 indexed validatorId);
    event UnsupportedValidator(uint256 indexed validatorId);
    event DefaultValidatorIdChanged(uint256 indexed validatorId);

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

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
            // Get the staked amount and any pending rewards
            balance += sfc.getStake(
                address(this),
                validator
            );
            balance += sfc.pendingRewards(
                address(this),
                validator
            );
        }
    }

    /**
     * @dev Delegate from this strategy to a specific Sonic validator. Called
     * automatically on asset deposit
     * @param amount the amount of Sonic (S) to delegate.
     */
    function _delegate(uint256 amount) internal {
        require(
            isSupportedValidator(defaultValidatorId),
            "Validator not supported"
        );

        // unwrap Wrapped Sonic (wS) to native Sonic (S)
        IWrappedSonic(wrappedSonic).withdraw(amount);

        //slither-disable-next-line arbitrary-send-eth
        sfc.delegate{ value: amount }(defaultValidatorId);

        emit Delegated(defaultValidatorId, amount);
    }

    /**
     * @notice Undelegate from a specific Sonic validator.
     * This needs to be followed by a `withdrawFromSFC` two weeks later.
     * @param validatorId The Sonic validator ID to undelegate from.
     * @param undelegateAmount the amount of Sonic (S) to undelegate.
     */
    function undelegate(uint256 validatorId, uint256 undelegateAmount)
        external
        onlyRegistratorOrStrategist
        nonReentrant
        returns (uint256 withdrawId)
    {
        // Can still undelegate even if the validator is no longer supported
        require(undelegateAmount > 0, "Must undelegate something");

        uint256 amountDelegated = sfc.getStake(
            address(this),
            validatorId
        );
        require(undelegateAmount <= amountDelegated, "Insufficient delegation");

        withdrawId = nextWithdrawId++;

        withdrawals[withdrawId] = WithdrawRequest(
            validatorId,
            undelegateAmount,
            block.timestamp
        );
        pendingWithdrawals += undelegateAmount;

        sfc.undelegate(validatorId, withdrawId, undelegateAmount);

        emit Undelegated(withdrawId, validatorId, undelegateAmount);
    }

    /**
     * @notice Withdraw native S from a previously undelegated validator.
     * The native S is wrapped wS and transferred to the Vault.
     * @param withdrawId The withdraw ID returned from `undelegate` and emitted in `Undelegated`.
     * @return withdrawnAmount The amount of Sonic (S) withdrawn.
     * This can be less than the undelegated amount in the event of slashing.
     */
    // slither-disable-start reentrancy-no-eth
    function withdrawFromSFC(uint256 withdrawId)
        external
        onlyRegistrator
        nonReentrant
        returns (uint256 withdrawnAmount)
    {
        require(withdrawId < nextWithdrawId, "Invalid withdrawId");

        // Can still withdraw even if the validator is no longer supported
        // Load the withdrawal from storage into memory
        WithdrawRequest memory withdrawal = withdrawals[withdrawId];
        require(!isWithdrawnFromSFC(withdrawId), "Already withdrawn");

        uint256 sBalanceBefore = address(this).balance;

        sfc.withdraw(withdrawal.validatorId, withdrawId);

        // Save state to storage
        withdrawnAmount = address(this).balance - sBalanceBefore;
        pendingWithdrawals -= withdrawal.undelegatedAmount;
        withdrawals[withdrawId].undelegatedAmount = 0;

        // Wrap Sonic (S) to Wrapped Sonic (wS)
        IWrappedSonic(wrappedSonic).deposit{ value: withdrawnAmount }();

        // Transfer the Wrapped Sonic (wS) to the Vault
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(wrappedSonic).transfer(vaultAddress, withdrawnAmount);

        // withdrawal.undelegatedAmount & withdrawnAmount can differ in case of slashing
        emit Withdrawn(
            withdrawId,
            withdrawal.validatorId,
            withdrawal.undelegatedAmount,
            withdrawnAmount
        );
    }

    // slither-disable-end reentrancy-no-eth

    /// @notice returns a bool whether a withdrawalId has already been withdrawn or not
    function isWithdrawnFromSFC(uint256 withdrawId) public view returns (bool) {
        WithdrawRequest memory withdrawal = withdrawals[withdrawId];
        require(withdrawal.validatorId > 0, "Invalid withdrawId");
        return withdrawal.undelegatedAmount == 0;
    }

    /**
     * @notice Restake any pending validator rewards for all supported validators
     * @param validatorIds List of Sonic validator IDs to restake rewards
     */
    function restakeRewards(uint256[] calldata validatorIds)
        external
        nonReentrant
    {
        for (uint256 i = 0; i < validatorIds.length; ++i) {
            uint256 rewards = sfc.pendingRewards(
                address(this),
                validatorIds[i]
            );

            if (rewards > 0) {
                sfc.restakeRewards(validatorIds[i]);
            }
        }

        // The SFC contract will emit Delegated and RestakedRewards events.
        // The checkBalance function should not change as the pending rewards will moved to the staked amount.
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

    /// @notice Set the address of the Registrator which can delegate, undelegate and withdraw
    function setRegistrator(address _address) external onlyGovernor {
        validatorRegistrator = _address;
        emit RegistratorChanged(_address);
    }

    /// @notice Set the default validatorId to delegate to on deposit
    function setDefaultValidatorId(uint256 validatorId)
        external
        onlyRegistratorOrStrategist
    {
        require(isSupportedValidator(validatorId), "Validator not supported");
        defaultValidatorId = validatorId;
        emit DefaultValidatorIdChanged(validatorId);
    }

    /// @notice Allows a validator to be delegated to by the Registrator
    function supportValidator(uint256 validatorId) external onlyGovernor {
        require(
            !isSupportedValidator(validatorId),
            "Validator already supported"
        );

        supportedValidators.push(validatorId);

        emit SupportedValidator(validatorId);
    }

    /// @notice Removes a validator from the supported list.
    /// Unsupported validators can still be undelegated from, withdrawn from and rewards collected.
    function unsupportValidator(uint256 validatorId) external onlyGovernor {
        require(isSupportedValidator(validatorId), "Validator not supported");
        require(
            sfc.getStake(address(this), validatorId) == 0,
            "Validator still has stake"
        );

        uint256 validatorLen = supportedValidators.length;
        for (uint256 i = 0; i < validatorLen; ++i) {
            if (supportedValidators[i] == validatorId) {
                supportedValidators[i] = supportedValidators[validatorLen - 1];
                supportedValidators.pop();
                break;
            }
        }

        emit UnsupportedValidator(validatorId);
    }

    /// @notice Returns the length of the supportedValidators array
    function supportedValidatorsLength() external view returns (uint256) {
        return supportedValidators.length;
    }

    /// @notice Returns whether a validator is supported by this strategy
    function isSupportedValidator(uint256 validatorId)
        public
        view
        returns (bool)
    {
        uint256 validatorLen = supportedValidators.length;
        for (uint256 i = 0; i < validatorLen; ++i) {
            if (supportedValidators[i] == validatorId) {
                return true;
            }
        }
        return false;
    }
}
