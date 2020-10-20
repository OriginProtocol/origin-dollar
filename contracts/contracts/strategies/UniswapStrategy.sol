pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

// can't just import router - it wants >=0.6.2;
/* import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol"; */

// prefer this one
/* import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol"; */
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
    function use_extra_bytes_for_treasury_actions()
        external
        pure
        returns (bool, ParticularConfig.EscapeHatch)
    {
        return (true, ParticularConfig.EscapeHatch.Uniswap);
    }

    function _tokens(address p) public returns (address, address) {
        return (IUniswapV2Pair(p).token0(), IUniswapV2Pair(p).token1());
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

    function _best_pair_for_asset(address asset) private returns (address) {
        // todo - does a for loop over pairs and picks the best for
        // this coin
        /* return in_pairs[i] */
        // temp dai_usdt
        return 0xB20bd5D04BE54f870D5C0d3cA85d82b34B836405;
    }

    function specific_treasury_action_deposit(address asset, uint256 amount)
        external
    {
        address _best_pair = _best_pair_for_asset(asset);
        (address token0, address token1) = _tokens(_best_pair);
        // the transferFroms
        //
    }

    // deposit takes a meaning of LP token as percentage of the total pair
    // TODO could change deposit signature elsewhere?
    function deposit(address _asset, uint256 _amount)
        external
        returns (uint256 amountDeposited)
    {
        require(_amount <= 1000, "must be percentage");

        uint256 total_amount = IERC20(_asset).totalSupply();
        uint256 want_lp_deposit_worth = (total_amount * _amount) / 1000;

        (address token0, address token1) = _tokens(_asset);

        // TODO need to use sqrt to figure out of much of each token to do
        // the transferFrom

        /* IERC20(token0).transferFrom( */
        /*     msg.sender, */
        /*     start_out_with[i].last_deposited_amount_token0 */
        /* ); */

        /* IERC20(token1).transferFrom( */
        /*     msg.sender, */
        /*     start_out_with[i].last_deposited_amount_token0 */
        /* ); */

        /* address _other_token = _other_token_of_pair(_asset); */
        /* if (token0 == _asset) { */
        /* IERC20(token1).safeTransferFrom(msg.sender, address(this), ) */
        /* } else { */
        /*     // */
        /* } */

        /* (, , uint256 lp_token) = IUniswapV2Router02(router).addLiquidity( */
        /*     _other_token, */
        /*     _asset, */
        /*     0, */
        /*     0, */
        /*     0, */
        /*     0, */
        /*     address(this), */
        /*     now + 1200 */
        /* ); */
        return 0;
        /* return lp_token; */
    }

    /**
     * @dev Withdraw given asset from Lending platform
     */

    // amount is lp token pool amount by percentage

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

    function withdraw(
        address _recipient,
        address _asset,
        // percentage scaled to 1e4
        uint256 _amount
    ) external returns (uint256 amountWithdrawn, bytes memory) {
        require(_amount < 1000, "at most 1000");
        WithdrawAmounts memory withdraws = _how_much_remove(_asset, _amount);

        (uint256 token0_received, uint256 token1_received) = IUniswapV2Router02(
            router
        )
            .removeLiquidity(
            withdraws.token0,
            withdraws.token1,
            withdraws.how_much_remove,
            // TODO revisit next two params
            0,
            0,
            _recipient,
            now + 1200
        );

        // returning uint256(-1) means look at the return bytes
        return (uint256(-1), abi.encode(token0_received, token1_received));
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
        return 1;
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
