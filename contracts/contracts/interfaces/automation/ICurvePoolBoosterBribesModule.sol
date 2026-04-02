// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface ICurvePoolBoosterBribesModule is IAbstractSafeModule {
    event BridgeFeeUpdated(uint256 newFee);
    event AdditionalGasLimitUpdated(uint256 newGasLimit);
    event PoolBoosterAddressAdded(address pool);
    event PoolBoosterAddressRemoved(address pool);

    function poolBoosters(uint256 index) external view returns (address);

    function isPoolBooster(address pool) external view returns (bool);

    function bridgeFee() external view returns (uint256);

    function additionalGasLimit() external view returns (uint256);

    function addPoolBoosterAddress(address[] calldata _poolBoosters) external;

    function removePoolBoosterAddress(address[] calldata _poolBoosters)
        external;

    function setBridgeFee(uint256 newFee) external;

    function setAdditionalGasLimit(uint256 newGasLimit) external;

    function manageBribes(address[] calldata selectedPoolBoosters) external;

    function manageBribes(
        address[] calldata selectedPoolBoosters,
        uint256[] calldata totalRewardAmounts,
        uint8[] calldata extraDuration,
        uint256[] calldata rewardsPerVote
    ) external;

    function getPoolBoosters() external view returns (address[] memory);
}
