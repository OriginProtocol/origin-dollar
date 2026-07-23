// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ICurveStableSwapFactoryNG {
    function deploy_plain_pool(
        string memory _name,
        string memory _symbol,
        address[] memory _coins,
        uint256 _A,
        uint256 _fee,
        uint256 _offpeg_fee_multiplier,
        uint256 _ma_exp_time,
        uint256 _implementation_idx,
        uint8[] memory _asset_types,
        bytes4[] memory _method_ids,
        address[] memory _oracles
    ) external returns (address);

    function deploy_gauge(address _pool) external returns (address);
}
