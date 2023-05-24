pragma solidity ^0.8.0;

interface IGetExchangeRateToken {
    function getExchangeRate() external view returns (uint256 _exchangeRate);
}
