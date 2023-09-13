// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IOracleReceiver } from "./IOracleReceiver.sol";
import { AggregatorV3Interface } from "../interfaces/chainlink/AggregatorV3Interface.sol";
import { Governable } from "../governance/Governable.sol";

/**
 * @title BaseOracle
 * @notice Generic Chainlink style oracle
 * @author Origin Protocol Inc
 */
abstract contract BaseOracle is
    AggregatorV3Interface,
    IOracleReceiver,
    Governable
{
    /// @notice Contract or account that can call addRoundData() to update the Oracle prices
    address public oracleUpdater;

    /// @notice Last round ID where isBadData is false and price is within maximum deviation
    uint80 public lastCorrectRoundId;

    /// @notice Historical Oracle prices
    Round[] public rounds;

    /// @notice Time in seconds between updates before the price is considered stale
    uint256 public heartbeatThreshold;

    /// @notice Packed Round data struct
    /// @notice answer Oracle price
    /// @notice timestamp timestamp in seconds of price
    /// @notice isBadData If data is bad / should be used
    struct Round {
        uint128 answer;
        uint40 timestamp;
        bool isBadData;
    }

    event SetHeartbeatThreshold(uint256 heartbeatThreshold);
    event SetOracleUpdater(address oracleUpdater);


    constructor(
        address _oracleUpdater,
        uint256 _maximumOracleDelay
    ) Governable() {
        _setOracleUpdater(_oracleUpdater);
        _setHeartbeatThreshold(_maximumOracleDelay);
    }

    /***************************************
                Internal Setters
    ****************************************/

    /// @notice Sets the max oracle delay to determine if data is stale
    /// @param _heartbeatThreshold The time in seconds before the price is considered stale
    function _setHeartbeatThreshold(uint256 _heartbeatThreshold) internal {
        emit SetHeartbeatThreshold(_heartbeatThreshold);
        heartbeatThreshold = _heartbeatThreshold;
    }

    /// @notice Sets the contract or account that can add Oracle prices
    /// @param _oracleUpdater Address of the contract or account that can update the Oracle prices
    function _setOracleUpdater(address _oracleUpdater) internal {
        emit SetOracleUpdater(_oracleUpdater);
        oracleUpdater = _oracleUpdater;
    }

    /***************************************
                External Setters
    ****************************************/

    /// @notice Sets the max Oracle delay to determine if data is stale
    /// @param _heartbeatThreshold The time in seconds before the price is considered stale
    function setHeartbeatThreshold(
        uint256 _heartbeatThreshold
    ) external onlyGovernor {
        _setHeartbeatThreshold(_heartbeatThreshold);
    }

    /// @notice Sets the contract or account that can update the Oracle prices
    /// @param _oracleUpdater Address of the contract or account that can update the Oracle prices
    function setOracleUpdater(address _oracleUpdater) external onlyGovernor {
        _setOracleUpdater(_oracleUpdater);
    }

    /***************************************
                Metadata
    ****************************************/

    /// @notice The number of decimals in the Oracle price.
    function decimals()
        external
        pure
        virtual
        override
        returns (uint8 _decimals)
    {
        _decimals = 18;
    }

    /// @notice The version number for the AggregatorV3Interface.
    /// @dev Adheres to AggregatorV3Interface, which is different than typical semver
    function version()
        external
        view
        virtual
        override
        returns (uint256 _version)
    {
        _version = 1;
    }

    /***************************************
                Oracle Receiver
    ****************************************/

    /// @notice Adds a new Oracle price by the Oracle updater.
    /// @param _isBadData Boolean representing if the data is bad
    /// @param _answer is the Oracle price with 18 decimals
    /// @param _timestamp The timestamp of the update
    function addRoundData(
        bool _isBadData,
        uint128 _answer,
        uint40 _timestamp
    ) external override {
        if (msg.sender != oracleUpdater) revert OnlyOracleUpdater();
        if (_timestamp > block.timestamp) revert CalledWithFutureTimestamp();

        uint256 _roundsLength = rounds.length;
        if (
            _roundsLength > 0 &&
            _timestamp <= rounds[_roundsLength - 1].timestamp
        ) {
            revert CalledWithTimestampBeforePreviousRound();
        }

        if (!_isBadData) {
            lastCorrectRoundId = uint80(_roundsLength);
        }

        rounds.push(
            Round({
                isBadData: _isBadData,
                answer: _answer,
                timestamp: _timestamp
            })
        );
    }

    /***************************************
                Prices
    ****************************************/

    function _getRoundData(
        uint80 _roundId
    )
        internal
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        if (rounds.length <= _roundId) revert NoPriceData();

        Round memory _round = rounds[_roundId];
        answer = int256(uint256(_round.answer));

        roundId = answeredInRound = _roundId;
        startedAt = updatedAt = _round.timestamp;
    }

    /// @notice Returns the Oracle price data for a specific round.
    /// @param _roundId The round ID
    /// @return roundId The round ID
    /// @return answer The Oracle price
    /// @return startedAt Timestamp of when the round started
    /// @return updatedAt Timestamp of when the round was updated
    /// @return answeredInRound The round ID in which the answer was computed
    function getRoundData(
        uint80 _roundId
    )
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        (
            roundId,
            answer,
            startedAt,
            updatedAt,
            answeredInRound
        ) = _getRoundData(_roundId);
    }

    /// @notice Returns the latest Oracle price data.
    /// @return roundId The round ID
    /// @return answer The Oracle price
    /// @return startedAt Timestamp of when the round started
    /// @return updatedAt Timestamp of when the round was updated
    /// @return answeredInRound The round ID in which the answer was computed
    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        (
            roundId,
            answer,
            startedAt,
            updatedAt,
            answeredInRound
        ) = _getRoundData(lastCorrectRoundId);
    }

    /***************************************
                Errors
    ****************************************/

    error CalledWithFutureTimestamp();
    error CalledWithTimestampBeforePreviousRound();
    error NoPriceData();
    error OnlyOracleUpdater();
}
