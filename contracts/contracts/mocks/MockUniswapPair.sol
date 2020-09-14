pragma solidity 0.5.11;

import "../oracle/UniswapLib.sol";


contract MockUniswapPair is IUniswapV2Pair {
    address tok0;
    address tok1;
    uint112 reserve0;
    uint112 reserve1;
    uint256 blockTimestampLast;

    constructor(address _token0, address _token1, uint112 _reserve0, uint112 _reserve1) public {
        tok0 = _token0;
        tok1 = _token1;
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = block.timestamp;
    }

    function token0() external view returns (address) {
        return tok0;
    }

    function token1() external view returns (address) {
        return tok1;
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, uint32(blockTimestampLast));
    }

    function setReserves(uint112 _reserve0, uint112 _reserve1) public {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
        blockTimestampLast = block.timestamp;
    }

    function price0CumulativeLast() external view returns (uint256) {
       uint256 timeElapsed = block.timestamp - blockTimestampLast;
       return uint256(FixedPoint.fraction(reserve1, reserve0)._x) * timeElapsed;
    }

    function price1CumulativeLast() external view returns (uint256) {
        uint256 timeElapsed = block.timestamp - blockTimestampLast;
        return uint256(FixedPoint.fraction(reserve0, reserve1)._x) * timeElapsed;
    }
}