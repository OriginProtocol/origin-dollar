pragma solidity ^0.8.0;

import "./MintableERC20.sol";
import "./MockUniswapPair.sol";

contract MockMintableUniswapPair is MockUniswapPair, MintableERC20 {
    constructor(
        address _token0,
        address _token1,
        uint112 _reserve0,
        uint112 _reserve1
    )
        public
        MockUniswapPair(_token0, _token1, _reserve0, _reserve1)
        ERC20("Uniswap V2", "UNI-v2")
    {}

    function decimals() public view override returns (uint8) {
        return 18;
    }
}
