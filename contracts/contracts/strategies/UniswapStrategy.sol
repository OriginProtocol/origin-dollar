pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IUniswapV2Pair } from "../interfaces/uniswap/IUniswapV2Pair.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "@uniswap/lib/contracts/libraries/Babylonian.sol";

import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";
import { ParticularConfig } from "../utils/Params.sol";

interface IUniswapV2Router02 {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        );

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}

interface PairReader {
    function _tokens(address p) external returns (address, address);
}

interface Factory {
    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);
}

contract UniswapStrategy is InitializableAbstractStrategy, PairReader {
    using SafeERC20 for IERC20;

    struct InPair {
        address pair;
        uint256 last_deposited_amount_token0;
        uint256 last_deposited_amount_token1;
        uint256 when_deposited;
    }

    InPair[] in_pairs;

    address
        private constant router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    // for strategy
    function deposit_kind()
        external
        view
        returns (ParticularConfig.DepositKind)
    {
        return ParticularConfig.DepositKind.UniswapTwoAsset;
    }

    function withdraw_kind()
        external
        view
        returns (ParticularConfig.WithdrawKind)
    {
        return (ParticularConfig.WithdrawKind.UniswapTwoAsset);
    }

    function _tokens(address p) public returns (address, address) {
        return (IUniswapV2Pair(p).token0(), IUniswapV2Pair(p).token1());
    }

    function check_all_underlying_balances(address pair_addr)
        external
        view
        returns (uint256[] memory balances)
    {
        uint256[] memory amts = new uint256[](2);
        uint256 bal = IERC20(pair_addr).balanceOf(address(this));
        uint256 total_supply = IERC20(pair_addr).totalSupply();

        (uint256 token0, uint256 token1, ) = IUniswapV2Pair(pair_addr)
            .getReserves();
        amts[0] = (bal * token0) / total_supply;
        amts[1] = (bal * token1) / total_supply;
        return amts;
    }

    function initialize(
        InPair[] calldata start_out_with,
        address[] calldata router_approvals
    ) external onlyGovernor initializer {
        uint256 i = 0;

        for (; i < start_out_with.length; i++) {
            (address token0, address token1) = _tokens(start_out_with[i].pair);
            in_pairs.push(InPair(start_out_with[i].pair, 0, 0, 0));
        }

        i = 0;

        for (; i < router_approvals.length; i++) {
            IERC20(router_approvals[i]).safeIncreaseAllowance(
                router,
                uint256(-1)
            );
        }
    }

    function deposit_two(
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _amount1
    ) public returns (uint256 deposited) {
        address token0;
        address token1;

        for (uint256 i = 0; i < in_pairs.length; i++) {
            (token0, token1) = _tokens(in_pairs[i].pair);
            if (token0 == _token0 && token1 == _token1) {
                (, , uint256 lp_token) = IUniswapV2Router02(router)
                    .addLiquidity(
                    token0,
                    token1,
                    _amount0,
                    _amount1,
                    (_amount0 * 98) / 100,
                    (_amount1 * 98) / 100,
                    address(this),
                    now + 1200
                );
                return lp_token;
            }
        }

        revert("did not find the pair");
    }

    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited)
    {
        revert("not meaningful on this strategy");
    }

    /**
     * @dev Withdraw given asset from Lending platform
     */

    struct WithdrawAmounts {
        address token0;
        address token1;
        uint256 how_much_remove;
    }

    function _how_much_remove(address _asset, uint256 _amount)
        private
        returns (WithdrawAmounts memory)
    {
        (address token0, address token1) = _tokens(_asset);
        uint256 total_amount = IERC20(_asset).balanceOf(address(this));
        return WithdrawAmounts(token0, token1, (total_amount * _amount) / 1000);
    }

    function withdraw_two(
        address _recipient,
        address _token0,
        address _token1,
        uint256 _amount0,
        uint256 _amount1
    ) external returns (uint256, uint256) {
        address token0;
        address token1;

        for (uint256 i = 0; i < in_pairs.length; i++) {
            (token0, token1) = _tokens(in_pairs[i].pair);
            if (token0 == _token0 && token1 == _token1) {
                // TODO compute how much actually want
                uint256 _temp = IERC20(in_pairs[i].pair).balanceOf(
                    address(this)
                );
                IERC20(in_pairs[i].pair).safeApprove(router, _temp);

                return
                    IUniswapV2Router02(router).removeLiquidity(
                        token0,
                        token1,
                        _temp,
                        (_amount0 * 98) / 100,
                        (_amount1 * 98) / 100,
                        address(this),
                        now + 1200
                    );
            }
        }

        revert("did not find the pair");
    }

    function withdraw(
        address _recipient,
        address _asset,
        // percentage scaled to 1e4
        uint256 _amount
    ) external returns (uint256) {
        revert("not supported");
    }

    /**
     * @dev Returns the current balance of the given asset.
     */
    function checkBalance(address _asset)
        external
        view
        returns (uint256 balance)
    {
        revert("not implemented");
    }

    function _abstractSetPToken(address _asset, address _pToken) internal {
        //
    }

    function safeApproveAllTokens() external {
        //
    }

    function liquidate() external {
        //
    }

    function supportsAsset(address _asset)
        external
        view
        returns (bool, bytes memory extra_data)
    {
        for (uint256 i = 0; i < in_pairs.length; i++) {
            (address token0, address token1) = (
                IUniswapV2Pair(in_pairs[i].pair).token0(),
                IUniswapV2Pair(in_pairs[i].pair).token1()
            );
            if (token0 == _asset || token1 == _asset) {
                return (true, abi.encode(in_pairs[i]));
            }
        }

        return (false, bytes(""));
    }
}
