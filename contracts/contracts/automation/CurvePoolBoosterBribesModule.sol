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
                break;
            }
        }
    }

    function manageBribes() external onlyOperator {
        uint256[] memory rewardsPerVote = new uint256[](POOLS.length);
        _manageBribes(rewardsPerVote);
    }

    function manageBribes(uint256[] memory rewardsPerVote)
        external
        onlyOperator
    {
        require(POOLS.length == rewardsPerVote.length, "Length mismatch");
        _manageBribes(rewardsPerVote);
    }

    function _manageBribes(uint256[] memory rewardsPerVote)
        internal
        onlyOperator
    {
        uint256 length = POOLS.length;
        for (uint256 i = 0; i < length; i++) {
            address poolBoosterAddress = POOLS[i];

            // PoolBooster need to have a balance of at least 0.003 ether to operate
            // 0.001 ether are used for the bridge fee
            require(
                poolBoosterAddress.balance > 0.003 ether,
                "Insufficient balance for bribes"
            );

            require(
                safeContract.execTransactionFromModule(
                    poolBoosterAddress,
                    0, // Value
                    abi.encodeWithSelector(
                        ICurvePoolBooster.manageNumberOfPeriods.selector,
                        1, // extraNumberOfPeriods
                        0.001 ether, // bridgeFee
                        1000000 // additionalGasLimit
                    ),
                    0
                ),
                "Manage number of periods failed"
            );

            require(
                safeContract.execTransactionFromModule(
                    poolBoosterAddress,
                    0, // Value
                    abi.encodeWithSelector(
                        ICurvePoolBooster.manageTotalRewardAmount.selector,
                        0.001 ether, // bridgeFee
                        1000000 // additionalGasLimit
                    ),
                    0
                ),
                "Manage total reward failed"
            );

            // Skip setting reward per vote if it's zero
            if (rewardsPerVote[i] == 0) continue;
            require(
                safeContract.execTransactionFromModule(
                    poolBoosterAddress,
                    0, // Value
                    abi.encodeWithSelector(
                        ICurvePoolBooster.manageRewardPerVote.selector,
                        rewardsPerVote[i], // newMaxRewardPerVote
                        0.001 ether, // bridgeFee
                        1000000 // additionalGasLimit
                    ),
                    0
                ),
                "Set reward per vote failed"
            );
        }
    }

    function getPools() external view returns (address[] memory) {
        return POOLS;
    }
}
