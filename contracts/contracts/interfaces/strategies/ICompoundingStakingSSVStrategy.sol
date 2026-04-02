// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "../ISSVNetwork.sol";
import { CompoundingValidatorManager } from "../../strategies/NativeStaking/CompoundingValidatorManager.sol";

interface ICompoundingStakingSSVStrategy {
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

    // Events (from CompoundingValidatorManager)
    event RegistratorChanged(address indexed newAddress);
    event FirstDepositReset();
    event SSVValidatorRegistered(
        bytes32 indexed pubKeyHash,
        uint64[] operatorIds
    );
    event SSVValidatorRemoved(bytes32 indexed pubKeyHash, uint64[] operatorIds);
    event ETHStaked(
        bytes32 indexed pubKeyHash,
        uint64 amountGwei,
        uint256 depositIndex
    );
    event ValidatorVerified(bytes32 indexed pubKeyHash, uint40 validatorIndex);
    event ValidatorInvalid(bytes32 indexed pubKeyHash);
    event DepositVerified(
        bytes32 indexed pendingDepositRoot,
        uint256 amountWei
    );
    event ValidatorWithdraw(bytes32 indexed pubKeyHash, uint256 amountWei);
    event BalancesSnapped(bytes32 indexed blockRoot, uint256 ethBalance);
    event BalancesVerified(
        uint64 snapTimestamp,
        uint256 totalBalance,
        uint256 depositedBalance,
        uint256 pendingBalance
    );

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

    function setPTokenAddress(address _asset, address _pToken) external;

    function removePToken(uint256 _index) external;

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    // CompoundingStakingSSVStrategy-specific
    function initialize(
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external;

    function depositedWethAccountedFor() external view returns (uint256);

    function validatorRegistrator() external view returns (address);

    function setRegistrator(address _address) external;

    function pause() external;

    function paused() external view returns (bool);

    function unPause() external;

    function resetFirstDeposit() external;

    function firstDeposit() external view returns (bool);

    function registerSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        bytes calldata sharesData,
        Cluster calldata cluster
    ) external;

    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external;

    function migrateClusterToETH(
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external;

    function stakeEth(
        CompoundingValidatorManager.ValidatorStakeData calldata stakeData,
        uint64 amountGwei
    ) external;

    function verifyValidator(
        uint64 nextBlockTimestamp,
        uint40 validatorIndex,
        bytes32 pubKeyHash,
        bytes32 withdrawalCredentials,
        bytes calldata validatorFieldsProof
    ) external;

    function verifyDeposit(
        bytes32 pendingDepositRoot,
        uint64 processedSlot,
        CompoundingValidatorManager.FirstPendingDepositSlotProofData
            calldata firstPending,
        CompoundingValidatorManager.StrategyValidatorProofData
            calldata strategyValidator
    ) external;

    function snapBalances() external;

    function verifyBalances(
        CompoundingValidatorManager.BalanceProofs calldata balanceProofs,
        CompoundingValidatorManager.PendingDepositProofs
            calldata pendingDepositProofs
    ) external;

    function validatorWithdrawal(bytes calldata publicKey, uint64 amountGwei)
        external
        payable;

    function validator(bytes32 pubKeyHash)
        external
        view
        returns (CompoundingValidatorManager.ValidatorState, uint40);

    function verifiedValidatorsLength() external view returns (uint256);

    function depositListLength() external view returns (uint256);

    function depositList(uint256 index) external view returns (bytes32);

    function deposits(bytes32 pendingDepositRoot)
        external
        view
        returns (
            bytes32 pubKeyHash,
            uint64 depositAmount,
            uint64 depositSlot,
            bool isVerified,
            uint40 validatorIndex
        );

    function snappedBalance()
        external
        view
        returns (
            bytes32 blockRoot,
            uint64 timestamp,
            uint128 ethBalance
        );

    function lastVerifiedEthBalance() external view returns (uint256);
}
