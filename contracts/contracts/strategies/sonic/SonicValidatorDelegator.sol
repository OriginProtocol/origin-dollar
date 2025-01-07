// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { ISFC } from "../../interfaces/sonic/ISFC.sol";
import { IWrappedSonic } from "../../interfaces/sonic/IWrappedSonic.sol";

import "hardhat/console.sol";

/**
 * @title Manages delegation to Sonic validators
 * @notice This contract implements all the required functionality to delegate to, undelegate from and withdraw from validators.
 * @author Origin Protocol Inc
 */
abstract contract SonicValidatorDelegator is InitializableAbstractStrategy {
    /// @notice Address of Sonic's wrapped S token
    address public immutable wrappedSonic;
    /// @notice Address of Sonic's Special Fee Contract (SFC)
    address public immutable sfc;

    /// @notice a unique ID for each withdrawal request
    uint256 public nextWithdrawId;
    /// @notice Sonic (S) that is pending withdrawal after undelegating
    uint256 public pendingWithdrawals;

    /// @notice List of supported validator IDs that can be delegated to
    uint256[] public supportedValidators;

    struct WithdrawRequest {
        uint256 validatorId;
        uint256 undelegatedAmount;
    }
    /// @notice Mapping of withdrawIds to validatorIds and undelegatedAmounts
    mapping(uint256 => WithdrawRequest) public withdrawals;

    /// @notice Address of the registrator - allowed to register, exit and remove validators
    address public validatorRegistrator;

    // For future use
    uint256[45] private __gap;

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

    /// @dev Throws if called by any account other than the Registrator
    modifier onlyRegistrator() {
        require(
            msg.sender == validatorRegistrator,
            "Caller is not the Registrator"
        );
        _;
    }

    /// @dev Throws if called by any account other than the Strategist
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wrappedSonic,
        address _sfc
    ) InitializableAbstractStrategy(_baseConfig) {
        wrappedSonic = _wrappedSonic;
        sfc = _sfc;
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
        for (uint256 i = 0; i < supportedValidators.length; i++) {
            // Get the staked amount and any pending rewards
            balance +=
                ISFC(sfc).getStake(address(this), supportedValidators[i]);
                ISFC(sfc).pendingRewards(address(this), supportedValidators[i]);
        }
    }

    /**
     * @notice Delegate from this strategy to a specific Sonic validator.
     * Only the registrator can call this function.
     * @param validatorId the ID of the validator to delegate to
     * @param amount the amount of Sonic (S) to delegate.
     */
    function delegate(uint256 validatorId, uint256 amount)
        external
        onlyRegistrator
        nonReentrant
    {
        require(isSupportedValidator(validatorId), "Validator not supported");
        require(amount > 0, "Must delegate something");

        // unwrap Wrapped Sonic (wS) to native Sonic (S)
        IWrappedSonic(wrappedSonic).withdraw(amount);

        ISFC(sfc).delegate{ value: amount }(validatorId);

        emit Delegated(validatorId, amount);
    }

    function undelegate(uint256 validatorId, uint256 undelegateAmount)
        external
        onlyRegistrator
        returns (uint256 withdrawId)
    {
        // Can still undelegate even if the validator is no longer supported
        require(undelegateAmount > 0, "Must undelegate something");

        uint256 amountDelegated = ISFC(sfc).getStake(
            address(this),
            validatorId
        );
        require(undelegateAmount <= amountDelegated, "Insufficient delegation");

        withdrawId = nextWithdrawId++;

        withdrawals[withdrawId] = WithdrawRequest(
            validatorId,
            undelegateAmount
        );
        pendingWithdrawals += undelegateAmount;

        ISFC(sfc).undelegate(validatorId, withdrawId, undelegateAmount);

        emit Undelegated(withdrawId, validatorId, undelegateAmount);
    }

    function withdraw(uint256 withdrawId)
        external
        onlyRegistrator
        returns (uint256 withdrawnAmount)
    {
        // Can still withdraw even if the validator is no longer supported
        // Load the withdrawal from storage into memory
        WithdrawRequest memory withdrawal = withdrawals[withdrawId];

        require(withdrawal.validatorId > 0, "Invalid withdrawId");
        require(withdrawal.undelegatedAmount > 0, "Already withdrawn");

        uint256 sBalanceBefore = address(this).balance;

        ISFC(sfc).withdraw(withdrawal.validatorId, withdrawId);

        withdrawnAmount = address(this).balance - sBalanceBefore;
        pendingWithdrawals -= withdrawal.undelegatedAmount;
        withdrawals[withdrawId].undelegatedAmount = 0;

        // Wrap Sonic (S) to Wrapped Sonic (wS)
        IWrappedSonic(wrappedSonic).deposit();

        // Transfer the Wrapped Sonic (wS) to the Vault
        IERC20(wrappedSonic).transfer(vaultAddress, withdrawnAmount);

        emit Withdrawn(
            withdrawId,
            withdrawal.validatorId,
            withdrawal.undelegatedAmount,
            withdrawnAmount
        );
    }

    /// @dev restake any pending validator rewards for all supported validators
    function restakeRewards(uint256[] calldata validatorIds) external {
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < validatorIds.length; ++i) {
            uint256 rewards = ISFC(sfc).pendingRewards(
                address(this),
                validatorIds[i]
            );

            if (rewards > 0) {
                totalRewards += rewards;
                ISFC(sfc).restakeRewards(validatorIds[i]);
            }
        }

        // TODO use Deposit event or something else?
        // The SFC contract will emit Delegated and RestakedRewards events
        emit Deposit(wrappedSonic, address(0), totalRewards);
    }

    /**
     * @notice To receive native S from SFC and Wrapped Sonic (wS)
     */
    receive() external payable {
        require(
            msg.sender == sfc || msg.sender == wrappedSonic,
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
            ISFC(sfc).getStake(address(this), validatorId) == 0,
            "Validator still has stake"
        );

        for (uint256 i = 0; i < supportedValidators.length; ++i) {
            if (supportedValidators[i] == validatorId) {
                supportedValidators[i] = supportedValidators[
                    supportedValidators.length - 1
                ];
                supportedValidators.pop();
                break;
            }
        }

        emit UnsupportedValidator(validatorId);
    }

    /// @notice Returns the length of the supportedValidators array
    function supportedValidatorsLength() external view returns(uint256) {
        return supportedValidators.length;
    }

    function isSupportedValidator(uint256 validatorId)
        public
        view
        returns (bool)
    {
        for (uint256 i = 0; i < supportedValidators.length; ++i) {
            if (supportedValidators[i] == validatorId) {
                return true;
            }
        }
        return false;
    }
}
