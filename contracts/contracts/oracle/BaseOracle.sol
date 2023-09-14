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

    /// @notice Packed Round data struct
    /// @notice price Oracle price to 18 decimals
    /// @notice timestamp timestamp in seconds of price
    struct Round {
        uint128 price;
        uint40 timestamp;
    }

    event SetOracleUpdater(address oracleUpdater);

    constructor(address _oracleUpdater) Governable() {
        _setOracleUpdater(_oracleUpdater);
    }

    /***************************************
                Internal Setters
    ****************************************/

    /// @notice Sets the contract or account that can add Oracle prices
    /// @param _oracleUpdater Address of the contract or account that can update the Oracle prices
    function _setOracleUpdater(address _oracleUpdater) internal {
        emit SetOracleUpdater(_oracleUpdater);
        oracleUpdater = _oracleUpdater;
    }

    /***************************************
                External Setters
    ****************************************/

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
    /// Can not be run twice in the same block.
    /// @param _price is the Oracle price with 18 decimals
    function addPrice(uint128 _price) external override {
        if (msg.sender != oracleUpdater) revert OnlyOracleUpdater();
        if (_price == 0) revert NoPriceData();

        // Can not add price in the same or previous blocks
        uint256 _roundsLength = rounds.length;
        if (
            _roundsLength > 0 &&
            block.timestamp <= rounds[_roundsLength - 1].timestamp
        ) {
            revert AddPriceSameBlock();
        }

        lastCorrectRoundId = uint80(_roundsLength);

        rounds.push(
            Round({ price: _price, timestamp: uint40(block.timestamp) })
        );
    }

    /***************************************
                Prices
    ****************************************/

    function _getRoundData(uint80 _roundId)
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
        answer = int256(uint256(_round.price));

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
    function getRoundData(uint80 _roundId)
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

    error AddPriceSameBlock();
    error NoPriceData();
    error OnlyOracleUpdater();
}
