// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IUniswapV4RebalanceModule is IAbstractSafeModule {
    event Rebalanced(
        uint256 indexed tokenId,
        uint128 liquidityRemoved,
        uint128 resetAmount0,
        uint128 liquidityAdded
    );

    function poolManager() external view returns (address);

    function positionManager() external view returns (address);

    function poolId() external view returns (bytes32);

    function minSqrtPriceX96() external view returns (uint160);

    function maxAmount0() external view returns (uint128);

    function rebalance(
        uint256 tokenId,
        uint128 liquidityToAdd,
        uint128 resetAmount0,
        uint160 sqrtPriceLimitX96
    ) external;

    function unlockCallback(bytes calldata data)
        external
        returns (bytes memory);
}
