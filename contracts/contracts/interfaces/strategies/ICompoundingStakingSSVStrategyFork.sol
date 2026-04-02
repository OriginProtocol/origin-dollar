// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Cluster } from "../ISSVNetwork.sol";
import { CompoundingBalanceProofs, CompoundingPendingDepositProofs, CompoundingValidatorState } from "./CompoundingStakingTypes.sol";

interface ICompoundingStakingSSVStrategyFork {
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance);

    function validator(bytes32 pubKeyHash)
        external
        view
        returns (CompoundingValidatorState, uint40);

    function depositedWethAccountedFor() external view returns (uint256);

    function validatorRegistrator() external view returns (address);

    function setRegistrator(address _address) external;

    function removeSsvValidator(
        bytes calldata publicKey,
        uint64[] calldata operatorIds,
        Cluster calldata cluster
    ) external;

    function snapBalances() external;

    function verifyBalances(
        CompoundingBalanceProofs calldata balanceProofs,
        CompoundingPendingDepositProofs calldata pendingDepositProofs
    ) external;

    function validatorWithdrawal(bytes calldata publicKey, uint64 amountGwei)
        external
        payable;

    function snappedBalance()
        external
        view
        returns (
            bytes32 blockRoot,
            uint64 timestamp,
            uint128 ethBalance
        );
}
