// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

interface ICurvePoolBooster {
    function manageCampaign(
        uint256 totalRewardAmount,
        uint8 numberOfPeriods,
        uint256 maxRewardPerVote,
        uint256 additionalGasLimit
    ) external payable;
}

/// @title CurvePoolBoosterBribesModule
/// @author Origin Protocol
/// @notice Gnosis Safe module that automates the management of VotemarketV2 bribe campaigns
///         across multiple CurvePoolBooster contracts. It instructs the Safe to call `manageCampaign`
///         on each registered pool booster, forwarding ETH from the Safe's balance to cover
///         bridge fees. Campaign parameters (reward amount, duration, reward rate) can be
///         configured per pool or left to sensible defaults.
contract CurvePoolBoosterBribesModule is AbstractSafeModule {
    ////////////////////////////////////////////////////
    /// --- Storage
    ////////////////////////////////////////////////////

    /// @notice List of CurvePoolBooster addresses managed by this module
    address[] public pools;

    /// @notice ETH amount sent per pool booster to cover the L1 -> L2 bridge fee
    uint256 public bridgeFee;

    /// @notice Gas limit passed to manageCampaign for cross-chain execution
    uint256 public additionalGasLimit;

    ////////////////////////////////////////////////////
    /// --- Events
    ////////////////////////////////////////////////////

    event BridgeFeeUpdated(uint256 newFee);
    event AdditionalGasLimitUpdated(uint256 newGasLimit);
    event PoolBoosterAddressAdded(address pool);
    event PoolBoosterAddressRemoved(address pool);

    ////////////////////////////////////////////////////
    /// --- Constructor
    ////////////////////////////////////////////////////

    /// @param _safeContract Address of the Gnosis Safe this module is attached to
    /// @param _operator Address authorized to call operator-restricted functions
    /// @param _pools Initial list of CurvePoolBooster addresses to manage
    /// @param _bridgeFee ETH amount to send per pool booster for bridge fees
    /// @param _additionalGasLimit Gas limit for cross-chain execution in manageCampaign
    constructor(
        address _safeContract,
        address _operator,
        address[] memory _pools,
        uint256 _bridgeFee,
        uint256 _additionalGasLimit
    ) AbstractSafeModule(_safeContract) {
        _grantRole(OPERATOR_ROLE, _operator);
        for (uint256 i = 0; i < _pools.length; i++) {
            _addPoolBoosterAddress(_pools[i]);
        }
        _setBridgeFee(_bridgeFee);
        _setAdditionalGasLimit(_additionalGasLimit);
    }

    ////////////////////////////////////////////////////
    /// --- External Mutative Functions
    ////////////////////////////////////////////////////

    /// @notice Add new CurvePoolBooster addresses to the managed list
    /// @param _pools Addresses to add
    function addPoolBoosterAddress(address[] calldata _pools)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _pools.length; i++) {
            _addPoolBoosterAddress(_pools[i]);
        }
    }

    /// @notice Remove CurvePoolBooster addresses from the managed list
    /// @param _pools Addresses to remove
    function removePoolBoosterAddress(address[] calldata _pools)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _pools.length; i++) {
            _removePoolBoosterAddress(_pools[i]);
        }
    }

    /// @notice Update the ETH bridge fee sent per pool booster
    /// @param newFee New bridge fee amount in wei
    function setBridgeFee(uint256 newFee) external onlyOperator {
        _setBridgeFee(newFee);
    }

    /// @notice Update the additional gas limit for cross-chain execution
    /// @param newGasLimit New gas limit value
    function setAdditionalGasLimit(uint256 newGasLimit) external onlyOperator {
        _setAdditionalGasLimit(newGasLimit);
    }

    /// @notice Default entry point to manage bribe campaigns for all registered pool boosters.
    ///         Applies the same behavior to every pool:
    ///           - totalRewardAmount = type(uint256).max → use all available reward tokens
    ///           - numberOfPeriods = 1 → extend by one period (week)
    ///           - maxRewardPerVote = 0 → no update
    /// @dev Calls `manageCampaign` on each pool booster via the Safe. The Safe must hold
    ///      enough ETH to cover `bridgeFee * pools.length`.
    function manageBribes() external onlyOperator {
        uint256[] memory totalRewardAmounts = new uint256[](pools.length);
        uint8[] memory extraDuration = new uint8[](pools.length);
        uint256[] memory rewardsPerVote = new uint256[](pools.length);
        for (uint256 i = 0; i < pools.length; i++) {
            totalRewardAmounts[i] = type(uint256).max; // use all available rewards
            extraDuration[i] = 1; // extend by 1 period (week)
            rewardsPerVote[i] = 0; // no update to maxRewardPerVote
        }
        _manageBribes(totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    /// @notice Fully configurable entry point to manage bribe campaigns. Allows setting
    ///         reward amounts, durations, and reward rates individually for each pool.
    ///         Each array must have the same length as the pools array.
    /// @param totalRewardAmounts Total reward amount per pool (0 = no update, type(uint256).max = use all available)
    /// @param extraDuration Number of periods to extend per pool (0 = no update, 1 = +1 week)
    /// @param rewardsPerVote Max reward per vote per pool (0 = no update)
    function manageBribes(
        uint256[] calldata totalRewardAmounts,
        uint8[] calldata extraDuration,
        uint256[] calldata rewardsPerVote
    ) external onlyOperator {
        require(pools.length == totalRewardAmounts.length, "Length mismatch");
        require(pools.length == extraDuration.length, "Length mismatch");
        require(pools.length == rewardsPerVote.length, "Length mismatch");
        _manageBribes(totalRewardAmounts, extraDuration, rewardsPerVote);
    }

    ////////////////////////////////////////////////////
    /// --- External View Functions
    ////////////////////////////////////////////////////

    /// @notice Get the full list of managed CurvePoolBooster addresses
    /// @return Array of pool booster addresses
    function getPools() external view returns (address[] memory) {
        return pools;
    }

    ////////////////////////////////////////////////////
    /// --- Internal Functions
    ////////////////////////////////////////////////////

    /// @notice Internal logic to add a single pool booster address
    /// @dev Reverts if the address is already in the pools array
    /// @param _pool Address to append to the pools array
    function _addPoolBoosterAddress(address _pool) internal {
        for (uint256 j = 0; j < pools.length; j++) {
            require(pools[j] != _pool, "Pool already added");
        }
        pools.push(_pool);
        emit PoolBoosterAddressAdded(_pool);
    }

    /// @notice Internal logic to remove a pool booster address
    /// @dev Swaps the target with the last element and pops to avoid gaps
    /// @param pool Address to remove from the pools array
    function _removePoolBoosterAddress(address pool) internal {
        uint256 length = pools.length;
        for (uint256 i = 0; i < length; i++) {
            if (pools[i] == pool) {
                pools[i] = pools[length - 1];
                pools.pop();
                emit PoolBoosterAddressRemoved(pool);
                return;
            }
        }
        revert("Pool not found");
    }

    /// @notice Internal logic to set the bridge fee
    /// @param newFee New bridge fee amount in wei
    function _setBridgeFee(uint256 newFee) internal {
        bridgeFee = newFee;
        emit BridgeFeeUpdated(newFee);
    }

    /// @notice Internal logic to set the additional gas limit
    /// @param newGasLimit New gas limit value
    function _setAdditionalGasLimit(uint256 newGasLimit) internal {
        additionalGasLimit = newGasLimit;
        emit AdditionalGasLimitUpdated(newGasLimit);
    }

    /// @notice Internal logic to manage bribe campaigns for all registered pool boosters
    /// @dev Iterates over all pool boosters and instructs the Safe to call `manageCampaign`
    ///      on each one, sending `bridgeFee` ETH from the Safe's balance per call.
    /// @param totalRewardAmounts Total reward amount per pool (0 = no update, type(uint256).max = use all available)
    /// @param extraDuration Number of periods to extend per pool (0 = no update)
    /// @param rewardsPerVote Max reward per vote per pool (0 = no update)
    function _manageBribes(
        uint256[] memory totalRewardAmounts,
        uint8[] memory extraDuration,
        uint256[] memory rewardsPerVote
    ) internal {
        uint256 length = pools.length;
        require(
            address(safeContract).balance >= bridgeFee * length,
            "Not enough ETH for bridge fees"
        );
        for (uint256 i = 0; i < length; i++) {
            address poolBoosterAddress = pools[i];
            require(
                safeContract.execTransactionFromModule(
                    poolBoosterAddress,
                    bridgeFee, // ETH value to cover bridge fee
                    abi.encodeWithSelector(
                        ICurvePoolBooster.manageCampaign.selector,
                        totalRewardAmounts[i], // 0 = no update, max = use all
                        extraDuration[i], // numberOfPeriods, 0 = no update, 1 = +1 period (week)
                        rewardsPerVote[i], // maxRewardPerVote, 0 = no update
                        additionalGasLimit
                    ),
                    0
                ),
                "Manage campaign failed"
            );
        }
    }
}
