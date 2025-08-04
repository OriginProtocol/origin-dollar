// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

interface ICurvePoolBooster {
    function manageTotalRewardAmount(
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external;

    function manageNumberOfPeriods(
        uint8 extraNumberOfPeriods,
        uint256 bridgeFee,
        uint256 additionalGasLimit
    ) external;
}

contract CurvePoolBoosterBribesModule is AbstractSafeModule {
    address[] public POOLS;

    event PoolBoosterAddressAdded(address pool);
    event PoolBoosterAddressRemoved(address pool);

    constructor(
        address _safeContract,
        address _operator,
        address[] memory _pools
    ) AbstractSafeModule(_safeContract) {
        _grantRole(OPERATOR_ROLE, _operator);
        _addPoolBoosterAddress(_pools);
    }

    function addPoolBoosterAddress(address[] memory pools)
        external
        onlyOperator
    {
        _addPoolBoosterAddress(pools);
    }

    function _addPoolBoosterAddress(address[] memory pools) internal {
        for (uint256 i = 0; i < pools.length; i++) {
            POOLS.push(pools[i]);
            emit PoolBoosterAddressAdded(pools[i]);
        }
    }

    function removePoolBoosterAddress(address[] calldata pools)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < pools.length; i++) {
            _removePoolBoosterAddress(pools[i]);
        }
    }

    function _removePoolBoosterAddress(address pool) internal {
        uint256 length = POOLS.length;
        for (uint256 i = 0; i < length; i++) {
            if (POOLS[i] == pool) {
                POOLS[i] = POOLS[length - 1];
                POOLS.pop();
                emit PoolBoosterAddressRemoved(pool);
            }
        }
    }

    function manageBribes() external onlyOperator {
        uint256 length = POOLS.length;
        for (uint256 i = 0; i < length; i++) {
            address poolBoosterAddress = POOLS[i];

            safeContract.execTransactionFromModule(
                poolBoosterAddress,
                0, // Value
                abi.encodeWithSelector(
                    ICurvePoolBooster.manageNumberOfPeriods.selector,
                    1, // extraNumberOfPeriods
                    1000000000000000, // bridgeFee
                    1000000 // additionalGasLimit
                ),
                0
            );

            safeContract.execTransactionFromModule(
                poolBoosterAddress,
                0, // Value
                abi.encodeWithSelector(
                    ICurvePoolBooster.manageTotalRewardAmount.selector,
                    1000000000000000, // bridgeFee
                    1000000 // additionalGasLimit
                ),
                0
            );
        }
    }
}
