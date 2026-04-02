// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "../ISSVNetwork.sol";
import { CompoundingValidatorManager } from "../../strategies/NativeStaking/CompoundingValidatorManager.sol";

interface IConsolidationController {
    // Ownable
    function owner() external view returns (address);

    function transferOwnership(address newOwner) external;

    // View functions
    function validatorRegistrator() external view returns (address);

    function consolidationCount() external view returns (uint64);

    function consolidationStartTimestamp() external view returns (uint64);

    function sourceStrategy() external view returns (address);

    function targetPubKeyHash() external view returns (bytes32);

    // State-changing functions
    function requestConsolidation(
        address _sourceStrategy,
        bytes[] calldata sourcePubKeys,
        bytes calldata targetPubKey
    ) external payable;

    function failConsolidation(bytes[] calldata sourcePubKeys) external;

    function confirmConsolidation(
        CompoundingValidatorManager.BalanceProofs calldata balanceProofs,
        CompoundingValidatorManager.PendingDepositProofs
            calldata pendingDepositProofs
    ) external;

    function doAccounting(address _sourceStrategy) external;

    function exitSsvValidator(
        address _sourceStrategy,
        bytes calldata publicKey,
        uint64[] calldata operatorIds
    ) external;

    function removeSsvValidator(
        address _sourceStrategy,
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
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

    function stakeEth(
        CompoundingValidatorManager.ValidatorStakeData calldata stakeData,
        uint64 amountGwei
    ) external;
}
