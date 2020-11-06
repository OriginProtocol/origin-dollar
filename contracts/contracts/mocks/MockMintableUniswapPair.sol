pragma solidity 0.5.11;

import "./MintableERC20.sol";
import "./MockUniswapPair.sol";

contract MockMintableUniswapPair is MockUniswapPair, MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "Uniswap V2";
    string public constant name = "UNI-V2";

    constructor(
        address _token0,
        address _token1,
        uint112 _reserve0,
        uint112 _reserve1
    ) public MockUniswapPair(_token0, _token1, _reserve0, _reserve1) {}
}
