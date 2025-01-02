// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { ISFC } from "../../interfaces/sonic/ISFC.sol";
import { IWrappedSonic } from "../../interfaces/sonic/IWrappedSonic.sol";

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

    uint256 public totalDelegated;
    uint256 public pendingWithdrawals;
    /**
     * @notice a unique ID for each withdrawal request
     */
    uint256 public nextWithdrawId;

    /// @notice Mapping of supported validatorIds
    mapping(uint256 => bool) public supportedValidators;

    struct WithdrawRequest {
        uint256 validatorId;
        uint256 undelegatedAmount;
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
        require(supportedValidators[validatorId], "Validator not supported");
        require(amount > 0, "Must delegate something");

        // unwrap Wrapped Sonic (wS) to native Sonic (S)
        IWrappedSonic(wrappedSonic).withdraw(amount);

        totalDelegated += amount;

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
        totalDelegated -= undelegateAmount;
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

    /// @dev Convert accumulated ETH to WETH and send to the Harvester.
    /// Will revert if the strategy is paused for accounting.
    function collectRewards(uint256[] calldata validatorIds) external {
        // Can still collect rewards even if the validator is no longer supported
        uint256 balanceBefore = address(this).balance;

        for (uint256 i = 0; i < validatorIds.length; ++i) {
            uint256 rewards = ISFC(sfc).pendingRewards(
                address(this),
                validatorIds[i]
            );

            if (rewards > 0) {
                ISFC(sfc).claimRewards(validatorIds[i]);
            }
        }

        uint256 totalRewards = address(this).balance - balanceBefore;

        require(
            address(this).balance >= totalRewards,
            "Insufficient S balance"
        );

        if (totalRewards > 0) {
            // Convert native S to Wrapped Sonic (wS)
            IWrappedSonic(wrappedSonic).deposit{ value: totalRewards }();

            IERC20(wrappedSonic).transfer(harvesterAddress, totalRewards);

            emit RewardTokenCollected(
                harvesterAddress,
                wrappedSonic,
                totalRewards
            );
        }
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
            supportedValidators[validatorId] == false,
            "Validator already supported"
        );
        supportedValidators[validatorId] = true;

        emit SupportedValidator(validatorId);
    }

    /// @notice Removes a validator from the supported list.
    /// Unsupported validators can still be undelegated from, withdrawn from and rewards collected.
    function unsupportValidator(uint256 validatorId) external onlyGovernor {
        require(
            supportedValidators[validatorId] == true,
            "Validator not supported"
        );

        supportedValidators[validatorId] = false;

        emit UnsupportedValidator(validatorId);
    }
}
