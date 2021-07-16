pragma solidity 0.5.11;

import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';

contract MockUniswapV3Pool {
  IUniswapV3Pool pool;

  function doSomethingWithPool() public {
    // pool.swap(...);
  }
}
