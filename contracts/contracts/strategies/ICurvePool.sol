pragma solidity 0.5.11;

interface ICurvePool {
    function add_liquidity(uint256[] calldata _amounts, uint256 _min) external;

    function calc_token_amount(uint256[] calldata _amounts, bool _deposit)
        external
        returns (uint256);

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) external;

    function calc_withdraw_one_coin(uint256 _amount, int128 _index)
        external
        view
        returns (uint256);

    function coins(uint256 _index) external view returns (address);
}
