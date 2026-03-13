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
    address[] public poolBoosters;

    /// @notice Tracks whether an address is a registered pool booster
    mapping(address => bool) public isPoolBooster;

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
    /// @param _poolBoosters Initial list of CurvePoolBooster addresses to manage
    /// @param _bridgeFee ETH amount to send per pool booster for bridge fees
    /// @param _additionalGasLimit Gas limit for cross-chain execution in manageCampaign
    constructor(
        address _safeContract,
        address _operator,
        address[] memory _poolBoosters,
        uint256 _bridgeFee,
        uint256 _additionalGasLimit
    ) AbstractSafeModule(_safeContract) {
        _grantRole(OPERATOR_ROLE, _operator);
        // slither-disable-next-line cache-array-length
        for (uint256 i = 0; i < _poolBoosters.length; i++) {
            _addPoolBoosterAddress(_poolBoosters[i]);
        }
        _setBridgeFee(_bridgeFee);
        _setAdditionalGasLimit(_additionalGasLimit);
    }

    ////////////////////////////////////////////////////
    /// --- External Mutative Functions
    ////////////////////////////////////////////////////

    /// @notice Add new CurvePoolBooster addresses to the managed list
    /// @param _poolBoosters Addresses to add
    function addPoolBoosterAddress(address[] calldata _poolBoosters)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _poolBoosters.length; i++) {
            _addPoolBoosterAddress(_poolBoosters[i]);
        }
    }

    /// @notice Remove CurvePoolBooster addresses from the managed list
    /// @param _poolBoosters Addresses to remove
    function removePoolBoosterAddress(address[] calldata _poolBoosters)
        external
        onlyOperator
    {
        for (uint256 i = 0; i < _poolBoosters.length; i++) {
            _removePoolBoosterAddress(_poolBoosters[i]);
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

    /// @notice Manage bribe campaigns for a selected subset of registered pool boosters.
    ///         Uses defaults for all selected pools:
    ///           - totalRewardAmount = type(uint256).max
    ///           - numberOfPeriods = 1
    ///           - maxRewardPerVote = 0
    /// @param selectedPoolBoosters Explicit list of registered pool boosters to manage
    function manageBribes(address[] calldata selectedPoolBoosters)
        external
        onlyOperator
    {
        uint256 selectedCount = selectedPoolBoosters.length;
        require(selectedCount > 0, "Empty pool list");

        uint256[] memory totalRewardAmounts = new uint256[](selectedCount);
        uint8[] memory extraDuration = new uint8[](selectedCount);
        uint256[] memory rewardsPerVote = new uint256[](selectedCount);
        for (uint256 i = 0; i < selectedCount; i++) {
            totalRewardAmounts[i] = type(uint256).max;
            extraDuration[i] = 1;
            rewardsPerVote[i] = 0;
        }
        _manageBribes(
            selectedPoolBoosters,
            totalRewardAmounts,
            extraDuration,
            rewardsPerVote
        );
    }

    /// @notice Fully configurable bribe management for an explicit list of pool boosters.
    /// @param selectedPoolBoosters Explicit list of registered pool boosters to manage
    /// @param totalRewardAmounts Total reward amount per selected pool
    /// @param extraDuration Number of periods to extend per selected pool
    /// @param rewardsPerVote Max reward per vote per selected pool
    function manageBribes(
        address[] calldata selectedPoolBoosters,
        uint256[] calldata totalRewardAmounts,
        uint8[] calldata extraDuration,
        uint256[] calldata rewardsPerVote
    ) external onlyOperator {
        uint256 selectedCount = selectedPoolBoosters.length;
        require(selectedCount > 0, "Empty pool list");
        require(selectedCount == totalRewardAmounts.length, "Length mismatch");
        require(selectedCount == extraDuration.length, "Length mismatch");
        require(selectedCount == rewardsPerVote.length, "Length mismatch");
        _manageBribes(
            selectedPoolBoosters,
            totalRewardAmounts,
            extraDuration,
            rewardsPerVote
        );
    }

    ////////////////////////////////////////////////////
    /// --- External View Functions
    ////////////////////////////////////////////////////

    /// @notice Get the full list of managed CurvePoolBooster addresses
    /// @return Array of pool booster addresses
    function getPoolBoosters() external view returns (address[] memory) {
        return poolBoosters;
    }

    ////////////////////////////////////////////////////
    /// --- Internal Functions
    ////////////////////////////////////////////////////

    /// @notice Internal logic to add a single pool booster address
    /// @dev Reverts if the address is already in the poolBoosters array
    /// @param _pool Address to append to the poolBoosters array
    function _addPoolBoosterAddress(address _pool) internal {
        require(_pool != address(0), "Zero address");
        require(!isPoolBooster[_pool], "Pool already added");
        poolBoosters.push(_pool);
        isPoolBooster[_pool] = true;
        emit PoolBoosterAddressAdded(_pool);
    }

    /// @notice Internal logic to remove a pool booster address
    /// @dev Swaps the target with the last element and pops to avoid gaps
    /// @param pool Address to remove from the poolBoosters array
    function _removePoolBoosterAddress(address pool) internal {
        uint256 length = poolBoosters.length;
        for (uint256 i = 0; i < length; i++) {
            if (poolBoosters[i] == pool) {
                poolBoosters[i] = poolBoosters[length - 1];
                poolBoosters.pop();
                isPoolBooster[pool] = false;
                emit PoolBoosterAddressRemoved(pool);
                return;
            }
        }
        revert("Pool not found");
    }

    /// @notice Internal logic to set the bridge fee
    /// @param newFee New bridge fee amount in wei
    function _setBridgeFee(uint256 newFee) internal {
        require(newFee <= 0.01 ether, "Bridge fee too high");
        bridgeFee = newFee;
        emit BridgeFeeUpdated(newFee);
    }

    /// @notice Internal logic to set the additional gas limit
    /// @param newGasLimit New gas limit value
    function _setAdditionalGasLimit(uint256 newGasLimit) internal {
        require(newGasLimit <= 10_000_000, "Gas limit too high");
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
        address[] memory selectedPoolBoosters,
        uint256[] memory totalRewardAmounts,
        uint8[] memory extraDuration,
        uint256[] memory rewardsPerVote
    ) internal {
        uint256 pbCount = selectedPoolBoosters.length;
        require(
            address(safeContract).balance >= bridgeFee * pbCount,
            "Not enough ETH for bridge fees"
        );
        for (uint256 i = 0; i < pbCount; i++) {
            address poolBoosterAddress = selectedPoolBoosters[i];
            require(isPoolBooster[poolBoosterAddress], "Invalid pool booster");
            for (uint256 j = i + 1; j < pbCount; j++) {
                require(
                    poolBoosterAddress != selectedPoolBoosters[j],
                    "Duplicate pool booster"
                );
            }
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
