// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISonicStakingStrategy {
    // Events (from InitializableAbstractStrategy)
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    event RewardTokenCollected(
        address recipient,
        address rewardToken,
        uint256 amount
    );
    event PTokenAdded(address indexed _asset, address _pToken);
    event PTokenRemoved(address indexed _asset, address _pToken);
    event RewardTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressesUpdated(
        address _oldHarvesterAddress,
        address _newHarvesterAddress
    );

    // Events (from SonicValidatorDelegator)
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

    // IStrategy functions
    function deposit(address _asset, uint256 _amount) external;

    function depositAll() external;

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    function withdrawAll() external;

    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    function supportsAsset(address _asset) external view returns (bool);

    function collectRewardTokens() external;

    function getRewardTokenAddresses() external view returns (address[] memory);

    function harvesterAddress() external view returns (address);

    function transferToken(address token, uint256 amount) external;

    function setRewardTokenAddresses(address[] calldata _rewardTokenAddresses)
        external;

    // InitializableAbstractStrategy functions
    function platformAddress() external view returns (address);

    function vaultAddress() external view returns (address);

    function setHarvesterAddress(address _harvesterAddress) external;

    function safeApproveAllTokens() external;

    function setPTokenAddress(address _asset, address _pToken) external;

    function removePToken(uint256 _index) external;

    function rewardTokenAddresses(uint256 _index)
        external
        view
        returns (address);

    function assetToPToken(address _asset) external view returns (address);

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    // SonicStakingStrategy-specific: initialize
    function initialize() external;

    // SonicValidatorDelegator functions
    function wrappedSonic() external view returns (address);

    function nextWithdrawId() external view returns (uint256);

    function pendingWithdrawals() external view returns (uint256);

    function supportedValidators(uint256 _index)
        external
        view
        returns (uint256);

    function defaultValidatorId() external view returns (uint256);

    function validatorRegistrator() external view returns (address);

    function supportValidator(uint256 _validatorId) external;

    function unsupportValidator(uint256 _validatorId) external;

    function setDefaultValidatorId(uint256 _validatorId) external;

    function setRegistrator(address _validatorRegistrator) external;

    function restakeRewards(uint256[] calldata _validatorIds) external;

    function collectRewards(uint256[] calldata _validatorIds) external;

    function withdrawFromSFC(uint256 _withdrawId)
        external
        returns (uint256 withdrawnAmount);

    function undelegate(uint256 _validatorId, uint256 _undelegateAmount)
        external
        returns (uint256 withdrawId);

    function isSupportedValidator(uint256 _validatorId)
        external
        view
        returns (bool);

    function supportedValidatorsLength() external view returns (uint256);

    function isWithdrawnFromSFC(uint256 _withdrawId)
        external
        view
        returns (bool);

    function withdrawals(uint256 _withdrawId)
        external
        view
        returns (
            uint256 validatorId,
            uint256 undelegatedAmount,
            uint256 timestamp
        );
}
