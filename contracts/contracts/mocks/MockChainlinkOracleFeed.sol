pragma solidity 0.5.11;

import "../oracle/AggregatorV3Interface.sol";

contract MockChainlinkOracleFeed is AggregatorV3Interface {
    int256 price;
    uint8 numDecimals;

    constructor(int256 _price, uint8 _decimals) public {
        price = _price;
        numDecimals = _decimals;
    }

    function decimals() external view returns (uint8) {
        return numDecimals;
    }

    function description() external view returns (string memory) {
        return "MockOracleEthFeed";
    }

    function version() external view returns (uint256) {
        return 1;
    }

    function setPrice(int256 _price) public {
        price = _price;
    }

    function setDecimals(uint8 _decimals) public {
        numDecimals = _decimals;
    }

    // getRoundData and latestRoundData should both raise "No data present"
    // if they do not have data to report, instead of returning unset values
    // which could be misinterpreted as actual reported values.
    function getRoundData(uint80 _roundId)
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = _roundId;
        answer = price;
        startedAt = 0;
        updatedAt = 0;
        answeredInRound = 0;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        roundId = 0;
        answer = price;
        startedAt = 0;
        updatedAt = 0;
        answeredInRound = 0;
    }
}
