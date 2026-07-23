// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "../ISSVNetwork.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

interface INativeStakingSSVStrategy {
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

    // Events (from ValidatorRegistrator)
    event RegistratorChanged(address indexed newAddress);
    event StakingMonitorChanged(address indexed newAddress);
    event ETHStaked(bytes32 indexed pubKeyHash, bytes pubKey, uint256 amount);
    event SSVValidatorRegistered(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event SSVValidatorExitInitiated(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event SSVValidatorExitCompleted(
        bytes32 indexed pubKeyHash,
        bytes pubKey,
        uint64[] operatorIds
    );
    event StakeETHThresholdChanged(uint256 amount);
    event StakeETHTallyReset();

    // Events (from ValidatorAccountant)
    event FuseIntervalUpdated(uint256 start, uint256 end);
    event AccountingFullyWithdrawnValidator(
        uint256 noOfValidators,
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingValidatorSlashed(
        uint256 remainingValidators,
        uint256 wethSentToVault
    );
    event AccountingConsensusRewards(uint256 amount);
    event AccountingManuallyFixed(
        int256 validatorsDelta,
        int256 consensusRewardsDelta,
        uint256 wethToVault
    );

    // Events (from Pausable)
    event Paused(address account);

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

    function rewardTokenAddresses(uint256 _index)
        external
        view
        returns (address);

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // NativeStakingSSVStrategy-specific
    function initialize(
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external;

    function activeDepositedValidators() external view returns (uint256);

    function consensusRewards() external view returns (uint256);

    function depositedWethAccountedFor() external view returns (uint256);

    function validatorsStates(bytes32 pubKeyHash) external view returns (uint8);

    function validatorRegistrator() external view returns (address);

    function stakingMonitor() external view returns (address);

    function FEE_ACCUMULATOR_ADDRESS() external view returns (address);

    function setRegistrator(address _address) external;

    function setFuseInterval(uint256 _start, uint256 _end) external;

    function setStakingMonitor(address _address) external;

    function setStakeETHThreshold(uint256 _amount) external;

    function resetStakeETHTally() external;

    function doAccounting() external returns (bool);

    function manuallyFixAccounting(
        int256 _validatorsDelta,
        int256 _consensusRewardsDelta,
        uint256 _wethToVault
    ) external;

    function pause() external;

    function paused() external view returns (bool);

    function stakeEth(ValidatorStakeData[] calldata validators) external;

    function registerSsvValidators(
        bytes[] calldata publicKeys,
        uint64[] calldata operatorIds,
        bytes[] calldata sharesData,
        Cluster calldata cluster
    ) external;

    function exitSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external;

    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external;

    function setFeeRecipient() external;
}
