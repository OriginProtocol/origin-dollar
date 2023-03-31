pragma solidity ^0.8.0;

interface IExchangeRateToken {
    function exchangeRate() external view returns (uint256 _exchangeRate);
}
