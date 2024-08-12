// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Aerodrome AMO strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

import { ISugarHelper } from "../../interfaces/aerodrome/ISugarHelper.sol";
import { INonfungiblePositionManager } from "../../interfaces/aerodrome/INonfungiblePositionManager.sol";
import { IQuoterV2 } from "../../interfaces/aerodrome/IQuoterV2.sol";
import { ISwapRouter } from "../../interfaces/aerodrome/ISwapRouter.sol";
import { ICLPool } from "../../interfaces/aerodrome/ICLPool.sol";
import { ICLGauge } from "../../interfaces/aerodrome/ICLGauge.sol";
import { IVault } from "../../interfaces/IVault.sol";

import "hardhat/console.sol";

contract AerodromeAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice tokenId of the liquidity position
    uint256 public tokenId;
    /// @dev Cumulative amount of WETH + OETHb tokens present in Aerodrome Slipstream pool
    ///      increase liquidity increases this number by the amount of tokens added
    ///      decrease liquidity decreases this number by the amount of tokens removed
    uint256 public netValue;
    /// @notice the swapRouter for performing swaps
    ISwapRouter public swapRouter;
    /// @notice the pool used
    ICLPool public clPool;
    /// @notice the pool used
    ICLGauge public clGauge;
    /// @notice the liquidity position
    INonfungiblePositionManager public positionManager;
    /// @notice helper contract for liquidity and ticker math
    ISugarHelper public helper;
    /// @notice helper contract for liquidity and ticker math
    IQuoterV2 public quoter;
    /// @notice sqrtRatioX96Tick0
    uint160 public sqrtRatioX96Tick0;
    /// @notice sqrtRatioX96Tick1
    uint160 public sqrtRatioX96Tick1;
    /**
     * @notice Specifies WETH to OETHb ratio the strategy contract aims for after rebalancing 
     * in basis point format.
     * 
     * e.g. 2000 means 20% WETH 80% OETHb
     */
    uint256 public poolWethShare;
    /**
     * @notice Specifies how the target WETH share of the pool defined by the `poolWethShare` can
     * vary from the configured value after rebalancing. Expressed in basis points.
     */
    uint256 public poolWethShareVarianceAllowed;
    /**
     * Share of liquidity to remove on rebalance
     */
    uint128 public withdrawLiquidityShare;
    /// @dev reserved for inheritance
    int256[50] private __reserved;

    /***************************************
          Constants, structs and events
    ****************************************/

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the OETHb token contract
    address public immutable OETHb;
    /// @notice lower tick set to 0 representing the price of 1. Equation 1.0001^0 = 1
    int24 public immutable lowerTick;
    /// @notice lower tick set to 1 representing the price of 1.0001. Equation 1.0001^1 = 1.0001
    int24 public immutable upperTick;
    /// @notice tick spacing of the pool (set to 1)
    int24 public immutable tickSpacing;

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8

    event PoolWethShareUpdated(
        uint256 newWethShare
    );

    event WithdrawLiqiudityShareUpdated(
        uint128 newWithdrawLiquidityShare
    );

    event PoolWethShareVarianceAllowedUpdated(
        uint256 poolWethShareVarianceAllowed
    );

    /**
     * @dev Verifies that the caller is the Governor, or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == governor() ||
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Not the Governor or Strategist"
        );
        _;
    }

    /// @param _stratConfig st
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _OETHbAddress Address of the Erc20 OETHb Token contract
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _OETHbAddress
    ) InitializableAbstractStrategy(_stratConfig)
    {
        WETH = _wethAddress;
        OETHb = _OETHbAddress;

        lowerTick = 0;
        upperTick = 1;
        tickSpacing = 1;
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     * @param _swapRouter Address of the Aerodrome Universal Swap Router
     * @param _nonfungiblePositionManager Address of position manager to add/remove
     *        the liquidity
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _clPool,
        address _clGauge,
        address _quoter,
        address _sugarHelper
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );

        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        clPool = ICLPool(_clPool);
        clGauge = ICLGauge(_clGauge);
        helper = ISugarHelper(_sugarHelper);
        quoter = IQuoterV2(_quoter);
        sqrtRatioX96Tick0 = helper.getSqrtRatioAtTick(0);
        sqrtRatioX96Tick1 = helper.getSqrtRatioAtTick(1);
    }

    /***************************************
                  Configuration 
    ****************************************/

    /**
     * TODO: delete once we get the gauge.
     */
    function setGauge(address _clGauge) external onlyGovernor {
        clGauge = ICLGauge(_clGauge);
    }

    /**
     * @notice Set the new desired WETH share
     * @param _amount               The new amount specified in basis points
     */
    function setPoolWethShare(uint256 _amount) external onlyGovernor {
        // TODO tests:
        // - governor can update
        // - non governor can not update
        // - must be within allowed values (event emitted)

        require(_amount < 10000, "Invalid poolWethShare amount");

        poolWethShare = _amount;
        emit PoolWethShareUpdated(_amount);
    }

    /**
     * @notice Specifies the amount of liquidity that is to be removed when 
     *         a rebalancing happens.
     * @param _amount               The new amount specified in basis points
     */
    function setWithdrawLiquidityShare(uint128 _amount) external onlyGovernor {
        // TODO tests:
        // - governor can update
        // - non governor can not update
        // - must be within allowed values (event emitted)

        require(_amount < 10000, "Invalid withdrawLiquidityShare amount");

        withdrawLiquidityShare = _amount;
        emit WithdrawLiqiudityShareUpdated(_amount);
    }

    /**
     * @notice Specifies how the target WETH share of the pool defined by the `poolWethShare` can
     *         vary from the configured value after rebalancing.
     * @param _amount               The new amount specified in basis points
     */
    function setPoolWethShareVarianceAllowed(uint256 _amount) external onlyGovernor {
        // TODO tests:
        // - governor can update
        // - non governor can not update
        // - must be within allowed values (event emitted)

        // no sensible reason to ever allow this over 20%
        require(_amount < 2000, "PoolWethShareVariance");

        poolWethShareVarianceAllowed = _amount;
        emit PoolWethShareVarianceAllowedUpdated(_amount);
    }
    
    /***************************************
               Strategy overrides 
    ****************************************/

    /**
     * @notice Deposit an amount of assets into the platform
     * @param _asset               Address for the asset
     * @param _amount              Units of asset to deposit
     */
    function deposit(address _asset, uint256 _amount) external virtual override {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit WETH to the contract. This function doesn't deposit the liquidity to the
     *      pool, that is done via the rebalance call.
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @notice Rebalance the pool to the desired token split and Deposit any WETH on the contract to the
     * underlying aerodrome pool. Print the required amount of corresponding OETHb.
     * 
     * Exact _amountToSwap, _minTokenReceived & _swapWETH parameters shall be determined by simulating the 
     * transaction off-chain. The strategy checks that after the swap the share of the tokens is in the 
     * expected ranges.
     * 
     * @param _amountToSwap The amount of the token to swap
     * @param _minTokenReceived Slippage check -> minimum amount of token expected in return
     * @param _swapWETH Swap using WETH when true, use OETHb when false
     */
    function rebalace(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) external nonReentrant onlyGovernorOrStrategist {
        _rebalace(_amountToSwap, _minTokenReceived, _swapWETH);
    }

    /**
     * @dev Rebalance the pool to the desired token split
     */
    function _rebalace(uint256 _amount, uint256 _minTokenReceived, bool _swapWETH) internal {
        _removeLiquidity();
        _swapToDesiredPosition(_amount, _minTokenReceived, _swapWETH);
        _addLiquidity();
        _checkLiquidityWithinExpectedShare();
    }

    /**
     * @dev Decrease withdrawLiquidityShare (currently set to 99%) of the liquidity if strategy holds any. In practice the removal of liquidity
     * will be skipped only on the first time called.
     */
    function _removeLiquidity() internal {
        if (tokenId == 0) {
            return;
        }

        clGauge.withdraw(tokenId);

        (uint128 liquidity,,) = _getPositionInfo();
        uint128 liqudityToRemove = liquidity * withdrawLiquidityShare / 1e4;

        // TODO add events
        (uint256 amountWETH, uint256 amountOETHb) = positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liqudityToRemove,
                /**
                 * Both expected amounts can be 0 since we don't really care if any swaps
                 * happen just before the liquidity removal.
                 */
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        positionManager.positions(tokenId);

        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max, // defaults to all tokens owed
                amount1Max: type(uint128).max  // defaults to all tokens owed
            })
        );

        // TODO can this go negative?
        netValue -= amountWETH + amountOETHb;
    }

    /**
     * @dev Check that the liquidity in the pool is withing the expected WETH to OETHb ratio
     */
    function _checkLiquidityWithinExpectedShare() internal {
        if (tokenId == 0) {
            return;
        }
        // TODO: calculate that the liquidiy shares are within the expected position
        console.log("checking shares");

        (uint256 amount0, uint256 amount1) = _getPositionPrincipal();
        console.log(amount0);
        console.log(amount1);

        // calculate in 1 of 2 ways
        // 1st way
        // uint256 currentWethShare = amount0 * 1e4 / (amount0 + amount1)
        // check that currentWethShare is within the poolWethShareVarianceAllowed of the
        // configurable poolWethShare

        // 2nd way
        // math should roughly be:
        // (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
        // uint160 tickPriceInterval = (sqrtRatioX96Tick1 - sqrtRatioX96Tick0);
        // uint160 targetPriceX96 = sqrtRatioX96Tick0 + 
        //    tickPriceInterval.mulTruncateScale(poolWethShare, 1e4)
        // - check that the targetPricex96 is within sqrtRatioX96 (with poolWethShareVarianceAllowed)

    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _swapToDesiredPosition(uint256 _amount, uint256 _minTokenReceived, bool _swapWETH) internal {
        IERC20 tokenToSwap = IERC20(_swapWETH ? WETH : OETHb);
        uint256 balance = tokenToSwap.balanceOf(address(this));

        // TODO not tested
        if(balance < _amount) {
            // if swapping OETHb
            if (!_swapWETH) {
               uint256 mintForSwap = _amount - balance;
               IVault(vaultAddress).mintForStrategy(mintForSwap);
            } else {
                revert NotEnoughWethForSwap(balance, _amount);
            }
        }

        // Swap it
        uint256 amountReceived = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: _swapWETH ? WETH : OETHb,
                tokenOut: _swapWETH ? OETHb : WETH,
                tickSpacing: tickSpacing, // set to 1
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: _amount,
                amountOutMinimum: _minTokenReceived, // slippage check
                // just a rough sanity check that we are within 0 -> 1 tick
                // a more fine check is performed in _checkLiquidityWithinExpectedShare
                sqrtPriceLimitX96: _swapWETH ? sqrtRatioX96Tick0 : sqrtRatioX96Tick1
            })
        );

        _checkLiquidityWithinExpectedShare();
    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _addLiquidity() internal {
        uint256 wethBalance = IERC20(WETH).balanceOf(address(this));
        require(wethBalance > 0, "Must add some WETH");

        // TODO mint corresponding 
        //IVault(vaultAddress).mintForStrategy(oethBRequired);

        if (tokenId == 0) {
            (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
            console.log("The current square root balance of the pool");
            console.log(sqrtRatioX96);

            // TODO add new token id position minted event
            (uint256 mintedTokenId,,uint256 amountWETH, uint256 amountOETHb) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: OETHb,
                    tickSpacing: 1,
                    tickLower: 0,
                    tickUpper: 1,
                    amount0Desired: wethBalance,
                    amount1Desired: 0,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    // needs to be 0 because the pool is already created
                    // non zero amount attempts to create a new instance of the pool
                    sqrtPriceX96: 0 
                })
            );
            tokenId = mintedTokenId;
            // TODO add incerase liquidity event
            netValue += amountWETH + amountOETHb;
        } else {

            (,uint256 amountWETH, uint256 amountOETHb) = positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: wethBalance,
                    amount1Desired: 0,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
            // TODO add incerase liquidity event
            netValue += amountWETH + amountOETHb;
        }

        clGauge.deposit(tokenId);
    }

    /**
     * @notice Deposit all supported assets in this strategy contract to the platform
     */
    function depositAll() external virtual override {
        _deposit(WETH, IERC20(WETH).balanceOf(address(this)));
    }

    /**
     * @notice Withdraw an `amount` of assets from the platform and
     * send to the `_recipient`.
     * @param _recipient         Address to which the asset should be sent
     * @param _asset             Address of the asset
     * @param _amount            Units of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual override {

    }

    /**
     * @notice Withdraw all supported assets from platform and
     * sends to the OToken's Vault.
     */
    function withdrawAll() external virtual override {
    }


    /**
     * @dev Default TODO
     */
    function _collectRewardTokens() internal override {
        // TODO do other stuff
        super._collectRewardTokens();
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /**
     * @dev Internal method to respond to the addition of new asset / pTokens
            We need to give the Aerodrome pool approval to transfer the
            asset.
     * @param _asset Address of the asset to approve
     * @param _pToken Address of the pToken
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        IERC20(_asset).safeApprove(address(positionManager), type(uint256).max);
        IERC20(_asset).safeApprove(address(swapRouter), type(uint256).max);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding aToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        IERC20(WETH).safeApprove(address(positionManager), type(uint256).max);
        IERC20(OETHb).safeApprove(address(positionManager), type(uint256).max);
        IERC20(WETH).safeApprove(address(swapRouter), type(uint256).max);
        IERC20(OETHb).safeApprove(address(swapRouter), type(uint256).max);
    }

    /***************************************
            Balances and Fees
    ****************************************/

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256)
    {
        return netValue;
    }

    /**
     * @notice Returns the accumulated fees from the active position
     * @return amount0 Amount of token0 ready to be collected as fee
     * @return amount1 Amount of token1 ready to be collected as fee
     */
    function getPendingFees()
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {

        (amount0, amount1) = helper.fees(
            positionManager,
            tokenId
        );
    }

    /**
     * @dev Returns the balance of both tokens in a given position (excluding fees)
     * @return amount0 Amount of token0 in position
     * @return amount1 Amount of token1 in position
     */
    function _getPositionPrincipal()
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
        (amount0, amount1) = helper.principal(
            positionManager,
            tokenId,
            sqrtRatioX96
        );
    }

    function _getPositionInfo() 
        internal 
        returns (
            uint128 liquidity,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        ) {

        if (tokenId > 0) {
            (,,,,,,,liquidity,,,tokensOwed0,tokensOwed1) = positionManager.positions(tokenId);
        }
    }

    /**
     * @dev Returns the fees in a given position
     * TODO: test this, should return 0 since we don't earn fees
     * @return amount0 Amount of token0 in position
     * @return amount1 Amount of token1 in position
     */
    function getPositionFees()
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();
        (amount0, amount1) = helper.fees(
            positionManager,
            tokenId
        );
    }

    /***************************************
            Hidden functions
    ****************************************/
    /// @inheritdoc InitializableAbstractStrategy
    function setPTokenAddress(address, address) external override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function removePToken(uint256) external override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }
}
