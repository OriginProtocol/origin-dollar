// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ICurveETHPoolV1 {
    event AddLiquidity(
        address indexed provider,
        uint256[2] token_amounts,
        uint256[2] fees,
        uint256 invariant,
        uint256 token_supply
    );
    event ApplyNewFee(uint256 fee);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
    event CommitNewFee(uint256 new_fee);
    event RampA(
        uint256 old_A,
        uint256 new_A,
        uint256 initial_time,
        uint256 future_time
    );
    event RemoveLiquidity(
        address indexed provider,
        uint256[2] token_amounts,
        uint256[2] fees,
        uint256 token_supply
    );
    event RemoveLiquidityImbalance(
        address indexed provider,
        uint256[2] token_amounts,
        uint256[2] fees,
        uint256 invariant,
        uint256 token_supply
    );
    event RemoveLiquidityOne(
        address indexed provider,
        uint256 token_amount,
        uint256 coin_amount,
        uint256 token_supply
    );
    event StopRampA(uint256 A, uint256 t);
    event TokenExchange(
        address indexed buyer,
        int128 sold_id,
        uint256 tokens_sold,
        int128 bought_id,
        uint256 tokens_bought
    );
    event Transfer(
        address indexed sender,
        address indexed receiver,
        uint256 value
    );

    function A() external view returns (uint256);

    function A_precise() external view returns (uint256);

    function DOMAIN_SEPARATOR() external view returns (bytes32);

    function add_liquidity(uint256[2] memory _amounts, uint256 _min_mint_amount)
        external
        payable
        returns (uint256);

    function add_liquidity(
        uint256[2] memory _amounts,
        uint256 _min_mint_amount,
        address _receiver
    ) external payable returns (uint256);

    function admin_action_deadline() external view returns (uint256);

    function admin_balances(uint256 i) external view returns (uint256);

    function admin_fee() external view returns (uint256);

    function allowance(address arg0, address arg1)
        external
        view
        returns (uint256);

    function apply_new_fee() external;

    function approve(address _spender, uint256 _value) external returns (bool);

    function balanceOf(address arg0) external view returns (uint256);

    function balances(uint256 arg0) external view returns (uint256);

    function calc_token_amount(uint256[2] memory _amounts, bool _is_deposit)
        external
        view
        returns (uint256);

    function calc_withdraw_one_coin(uint256 _burn_amount, int128 i)
        external
        view
        returns (uint256);

    function coins(uint256 arg0) external view returns (address);

    function commit_new_fee(uint256 _new_fee) external;

    function decimals() external view returns (uint256);

    function ema_price() external view returns (uint256);

    function exchange(
        int128 i,
        int128 j,
        uint256 _dx,
        uint256 _min_dy
    ) external payable returns (uint256);

    function exchange(
        int128 i,
        int128 j,
        uint256 _dx,
        uint256 _min_dy,
        address _receiver
    ) external payable returns (uint256);

    function fee() external view returns (uint256);

    function future_A() external view returns (uint256);

    function future_A_time() external view returns (uint256);

    function future_fee() external view returns (uint256);

    function get_balances() external view returns (uint256[2] memory);

    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);

    function get_p() external view returns (uint256);

    function get_virtual_price() external view returns (uint256);

    function initial_A() external view returns (uint256);

    function initial_A_time() external view returns (uint256);

    function initialize(
        string memory _name,
        string memory _symbol,
        address[4] memory _coins,
        uint256[4] memory _rate_multipliers,
        uint256 _A,
        uint256 _fee
    ) external;

    function last_price() external view returns (uint256);

    function ma_exp_time() external view returns (uint256);

    function ma_last_time() external view returns (uint256);

    function name() external view returns (string memory);

    function nonces(address arg0) external view returns (uint256);

    function permit(
        address _owner,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external returns (bool);

    function price_oracle() external view returns (uint256);

    function ramp_A(uint256 _future_A, uint256 _future_time) external;

    function remove_liquidity(
        uint256 _burn_amount,
        uint256[2] memory _min_amounts
    ) external returns (uint256[2] memory);

    function remove_liquidity(
        uint256 _burn_amount,
        uint256[2] memory _min_amounts,
        address _receiver
    ) external returns (uint256[2] memory);

    function remove_liquidity_imbalance(
        uint256[2] memory _amounts,
        uint256 _max_burn_amount
    ) external returns (uint256);

    function remove_liquidity_imbalance(
        uint256[2] memory _amounts,
        uint256 _max_burn_amount,
        address _receiver
    ) external returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 i,
        uint256 _min_received
    ) external returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _burn_amount,
        int128 i,
        uint256 _min_received,
        address _receiver
    ) external returns (uint256);

    function set_ma_exp_time(uint256 _ma_exp_time) external;

    function stop_ramp_A() external;

    function symbol() external view returns (string memory);

    function totalSupply() external view returns (uint256);

    function transfer(address _to, uint256 _value) external returns (bool);

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool);

    function version() external view returns (string memory);

    function withdraw_admin_fees() external;
}
