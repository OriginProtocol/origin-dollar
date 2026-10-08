// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ICLPool } from "../aerodrome/ICLPool.sol";
import { ICLGauge } from "../aerodrome/ICLGauge.sol";
import { ISwapRouter } from "../aerodrome/ISwapRouter.sol";
import { INonfungiblePositionManager } from "../aerodrome/INonfungiblePositionManager.sol";
import { ISugarHelper } from "../aerodrome/ISugarHelper.sol";

interface IAerodromeAMOStrategy {
    // Events (from InitializableAbstractStrategy)
    event Deposit(address indexed _asset, address _pToken, uint256 _amount);
    event Withdrawal(address indexed _asset, address _pToken, uint256 _amount);
    event RewardTokenCollected(
        address recipient,
        address rewardToken,
        uint256 amount
    );
    event PTokenAdded(address indexed _asset, address _pToken);
    event PTokenRemoved(address indexed _asset, address _pToken);
    event RewardTokenAddressesUpdated(
        address[] _oldAddresses,
        address[] _newAddresses
    );
    event HarvesterAddressesUpdated(
        address _oldHarvesterAddress,
        address _newHarvesterAddress
    );

    // Events (AerodromeAMOStrategy-specific)
    event PoolRebalanced(uint256 currentPoolWethShare);
    event PoolWethShareIntervalUpdated(
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    event LiquidityRemoved(
        uint256 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 wethAmountCollected,
        uint256 oethbAmountCollected,
        uint256 underlyingAssets
    );
    event LiquidityAdded(
        uint256 wethAmountDesired,
        uint256 oethbAmountDesired,
        uint256 wethAmountSupplied,
        uint256 oethbAmountSupplied,
        uint256 tokenId,
        uint256 underlyingAssets
    );
    event UnderlyingAssetsUpdated(uint256 underlyingAssets);

    // Errors
    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth);
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth);
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    error OutsideExpectedTickRange(int24 currentTick);

    // IStrategy functions
    function deposit(address _asset, uint256 _amount) external;

    function depositAll() external;

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external;

    function withdrawAll() external;

    function checkBalance(address _asset) external view returns (uint256);

    function supportsAsset(address _asset) external view returns (bool);

    function collectRewardTokens() external;

    function getRewardTokenAddresses() external view returns (address[] memory);

    function harvesterAddress() external view returns (address);

    function transferToken(address token, uint256 amount) external;

    function setRewardTokenAddresses(address[] calldata _rewardTokenAddresses)
        external;

    // InitializableAbstractStrategy functions
    function platformAddress() external view returns (address);

    function vaultAddress() external view returns (address);

    function setHarvesterAddress(address _harvesterAddress) external;

    function safeApproveAllTokens() external;

    function setPTokenAddress(address _asset, address _pToken) external;

    function removePToken(uint256 _index) external;

    function rewardTokenAddresses(uint256 _index)
        external
        view
        returns (address);

    function assetToPToken(address _asset) external view returns (address);

    // Governable
    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    // AerodromeAMOStrategy-specific: initialize
    function initialize(address[] memory _rewardTokenAddresses) external;

    // Configuration
    function setAllowedPoolWethShareInterval(
        uint256 _allowedWethShareStart,
        uint256 _allowedWethShareEnd
    ) external;

    // Rebalance
    function rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) external;

    // View functions
    function tokenId() external view returns (uint256);

    function underlyingAssets() external view returns (uint256);

    function allowedWethShareStart() external view returns (uint256);

    function allowedWethShareEnd() external view returns (uint256);

    function WETH() external view returns (address);

    function OETHb() external view returns (address);

    function lowerTick() external view returns (int24);

    function upperTick() external view returns (int24);

    function tickSpacing() external view returns (int24);

    function swapRouter() external view returns (ISwapRouter);

    function clPool() external view returns (ICLPool);

    function clGauge() external view returns (ICLGauge);

    function positionManager()
        external
        view
        returns (INonfungiblePositionManager);

    function helper() external view returns (ISugarHelper);

    function sqrtRatioX96TickLower() external view returns (uint160);

    function sqrtRatioX96TickHigher() external view returns (uint160);

    function sqrtRatioX96TickClosestToParity() external view returns (uint160);

    function SOLVENCY_THRESHOLD() external view returns (uint256);

    function getPositionPrincipal()
        external
        view
        returns (uint256 _amountWeth, uint256 _amountOethb);

    function getPoolX96Price() external view returns (uint160 _sqrtRatioX96);

    function getCurrentTradingTick() external view returns (int24 _currentTick);

    function getWETHShare() external view returns (uint256);

    // ERC721 receiver
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4);
}
