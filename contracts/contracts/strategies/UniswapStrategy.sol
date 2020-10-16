pragma solidity 0.5.11;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/lib/contracts/libraries/Babylonian.sol";

contract UniswapStrategy {
    using SafeMath for uint256;

    address
        private constant router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address private pair;

    function _get_liquidity_value() external view returns (uint256, uint256) {
        /* (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair) */
        /*     .getReserves(); */
        /* uint256 pool_token = IERC20(pair).balanceOf(address(this)); */
        /* uint256 all_pool_token = IERC20(pair).totalSupply(); */
        /* uint256 _our_share = pool_token / kLast; */
        /* uint256 root_K = Babylonian.sqrt(reserve0.mul(reserve1)); */
    }

    function _other_token_of_pair(address asset) internal returns (address) {
        /* (address token0, address token1) = ( */
        /*     IUniswapV2Pair(pair).token0(), */
        /*     IUniswapV2Pair(pair).token1() */
        /* ); */
        /* require(asset == token0 || asset == token1, "asset not in pair"); */
        /* return asset == token0 ? token1 : token0; */
    }

    function initialize(
        address _pair,
        address _token0,
        address _token1
    ) external {
        // so at init time we decide what pair to use
        /* token0 = _token0; */
        /* token1 = _token1; */
        pair = _pair;

        /* IERC20(_token0).safeIncreaseAllowance(router, uint256(-1)); */
        /* IERC20(_token1).safeIncreaseAllowance(router, uint256(-1)); */
    }

    //
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited)
    {
        address _other_token = _other_token_of_pair(asset);
        if (token0 == _asset) {
            /* IERC20(token1).safeTransferFrom(msg.sender, address(this), ) */
        } else {
            //
        }

        (, , uint256 lp_token) = IUniswapV2Router02(router).addLiquidity(
            _other_token,
            _asset,
            0,
            0,
            0,
            0,
            address(this),
            now + 1200
        );

        return lp_token;
    }

    /**
     * @dev Withdraw given asset from Lending platform
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external returns (uint256 amountWithdrawn) {
        address _other_token = _other_token_of_pair(_asset);
        /* 				IUniswapV2Router02(router).removeLiquidity(_other_token, */
        /* 																									 _asset, */

        /* ) */
    }

    /**
     * @dev Returns the current balance of the given asset.
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        //
        //
    }
}
