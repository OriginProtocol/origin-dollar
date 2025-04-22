// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICLPool } from "./ICLPool.sol";

interface IAMOStrategy {
    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth);
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth);
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    error OutsideExpectedTickRange(int24 currentTick);

    function governor() external view returns (address);

    function rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) external;

    function clPool() external view returns (ICLPool);

    function vaultAddress() external view returns (address);

    function poolWethShareVarianceAllowed() external view returns (uint256);

    function poolWethShare() external view returns (uint256);

    function tokenId() external view returns (uint256);

    function withdrawAll() external;

    function setAllowedPoolWethShareInterval(
        uint256 _allowedWethShareStart,
        uint256 _allowedWethShareEnd
    ) external;

    function setWithdrawLiquidityShare(uint128 share) external;

    function lowerTick() external view returns (int24);

    function upperTick() external view returns (int24);

    function getPoolX96Price() external view returns (uint160 _sqrtRatioX96);

    function sqrtRatioX96TickLower() external view returns (uint160);

    function sqrtRatioX96TickHigher() external view returns (uint160);

    function tickSpacing() external view returns (int24);

    function allowedWethShareStart() external view returns (uint256);

    function allowedWethShareEnd() external view returns (uint256);

    function claimGovernance() external;

    function transferGovernance(address _governor) external;

    function getPositionPrincipal()
        external
        view
        returns (uint256 _amountWeth, uint256 _amountOethb);
}
