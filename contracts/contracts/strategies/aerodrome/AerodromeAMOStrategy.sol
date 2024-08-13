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
    /// @notice the gauge for the corresponding Slipstream pool (clPool)
    /// @dev can become an immutable once the gauge is created on the base mainnet
    ICLGauge public clGauge;
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
    /// @notice the swapRouter for performing swaps
    ISwapRouter public immutable swapRouter;
    /// @notice the pool used
    ICLPool public immutable clPool;
    /// @notice the liquidity position
    INonfungiblePositionManager public immutable positionManager;
    /// @notice helper contract for liquidity and ticker math
    ISugarHelper public immutable helper;
    /// @notice helper contract for liquidity and ticker math
    IQuoterV2 public immutable quoter;
    /// @notice sqrtRatioX96Tick0
    uint160 public immutable sqrtRatioX96Tick0;
    /// @notice sqrtRatioX96Tick1
    uint160 public immutable sqrtRatioX96Tick1;

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 requiredPoolWethShare,
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    ); // 0x6c6108fb



    event PoolRebalanced(
        uint256 currentPoolWethShare,
        uint256 targetPoolWethShare,
        uint256 WETHPositionBalance,
        uint256 OETHbPositionBalance
    );
    
    event PoolWethShareUpdated(
        uint256 newWethShare
    );

    event WithdrawLiqiudityShareUpdated(
        uint128 newWithdrawLiquidityShare
    );

    event PoolWethShareVarianceAllowedUpdated(
        uint256 poolWethShareVarianceAllowed
    );

    event LiquidityRemoved(
        uint128 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 WETHAmountCollected,
        uint256 OETHbAmountCollected,
        uint256 netValue
    );

    event LiquidityAdded(
        uint256 WETHAmountDesired,
        uint256 OETHbAmountDesired,
        uint256 WETHAmountSupplied,
        uint256 OETHbAmountSupplied,
        uint256 tokenId,
        uint256 netValue
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
    /// @param _swapRouter Address of the Aerodrome Universal Swap Router
    /// @param _nonfungiblePositionManager Address of position manager to add/remove
    ///         the liquidity
    /// @param _clPool Address of the Aerodrome concentrated liquidity pool
    /// @param _quoter Address of the Aerodrome pool swap quoter
    /// @param _sugarHelper Address of the Aerodrome Sugar helper contract
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _OETHbAddress,
        address _swapRouter,
        address _nonfungiblePositionManager,
        address _clPool,
        address _quoter,
        address _sugarHelper
    ) InitializableAbstractStrategy(_stratConfig)
    {
        WETH = _wethAddress;
        OETHb = _OETHbAddress;
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        clPool = ICLPool(_clPool);
        helper = ISugarHelper(_sugarHelper);
        // TODO: delete quoter
        quoter = IQuoterV2(_quoter);
        sqrtRatioX96Tick0 = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(0);
        sqrtRatioX96Tick1 = ISugarHelper(_sugarHelper).getSqrtRatioAtTick(1);

        lowerTick = 0;
        upperTick = 1;
        tickSpacing = 1;
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     * @param _clGauge Address of the Aerodrome slipstream pool gauge
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens,
        address _clGauge
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        clGauge = ICLGauge(_clGauge);
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
    function deposit(address _asset, uint256 _amount) 
        external
        override
        onlyVault
        nonReentrant
    {
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
    function rebalance(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) external nonReentrant onlyGovernorOrStrategist {
        _rebalance(_amountToSwap, _minTokenReceived, _swapWETH);
    }

    /**
     * @dev Rebalance the pool to the desired token split
     */
    function _rebalance(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) internal {
        _removeLiquidity();
        _swapToDesiredPosition(_amountToSwap, _minTokenReceived, _swapWETH);
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

        (uint256 amountWETHCollected, uint256 amountOETHbCollected) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max, // defaults to all tokens owed
                amount1Max: type(uint128).max  // defaults to all tokens owed
            })
        );

        // TODO can this go negative?
        netValue -= amountWETH + amountOETHb;

        emit LiquidityRemoved(
            withdrawLiquidityShare,
            amountWETH, //removedWETHbAmount
            amountOETHb, //removedOETHbAmount
            amountWETHCollected,
            amountOETHbCollected,
            netValue
        );
    }

    /**
     * @dev Check that the liquidity in the pool is withing the expected WETH to OETHb ratio
     */
    function _checkLiquidityWithinExpectedShare() internal {
        if (tokenId == 0) {
            return;
        }

        (uint256 WETHPositionBalance, uint256 OETHbPositionBalance) = _getPositionPrincipal();
        // TODO check we are withing the expected tick range
        require(WETHPositionBalance + OETHbPositionBalance > 0, "Can not withhdraw full position");

        uint256 currentWethShareBp = WETHPositionBalance * 1e4 / (WETHPositionBalance + OETHbPositionBalance);

        if (poolWethShare < currentWethShareBp - poolWethShareVarianceAllowed ||
            poolWethShare > currentWethShareBp + poolWethShareVarianceAllowed) {
            revert PoolRebalanceOutOfBounds(
                currentWethShareBp,
                poolWethShare,
                WETHPositionBalance,
                OETHbPositionBalance
            );
        } else {
            emit PoolRebalanced(
                currentWethShareBp,
                poolWethShare,
                WETHPositionBalance,
                OETHbPositionBalance
            );
        }
    }

    /**
     * @dev Perform a swap so that after the swap the ticker has the desired WETH to OETHb token share.
     */
    function _swapToDesiredPosition(uint256 _amountToSwap, uint256 _minTokenReceived, bool _swapWETH) internal {
        IERC20 tokenToSwap = IERC20(_swapWETH ? WETH : OETHb);
        uint256 balance = tokenToSwap.balanceOf(address(this));

        if(balance < _amountToSwap) {
            // if swapping OETHb
            if (!_swapWETH) {
               uint256 mintForSwap = _amountToSwap - balance;
               IVault(vaultAddress).mintForStrategy(mintForSwap);
            } else {
                revert NotEnoughWethForSwap(balance, _amountToSwap);
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
                amountIn: _amountToSwap,
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
        uint256 WETHBalance = IERC20(WETH).balanceOf(address(this));
        uint256 OETHbBalance = IERC20(OETHb).balanceOf(address(this));
        require(WETHBalance > 0, "Must add some WETH");
        uint256 OETHbRequired;

        if (tokenId == 0) {
            // supply token amounts according to target poolWethShare amount
            OETHbRequired = (WETHBalance * 1e4 / poolWethShare)
                .mulTruncateScale((1e4 - poolWethShare), 1e4);

        } else {
            // supply the tokens to the pool according to the current position in the pool
            (uint256 WETHPositionBalance, uint256 OETHbPositionBalance) = _getPositionPrincipal();

            OETHbRequired = OETHbPositionBalance * 1e4 / WETHPositionBalance * WETHBalance / 1e4;
        }

        if (OETHbRequired > OETHbBalance) {
            IVault(vaultAddress).mintForStrategy(OETHbRequired - OETHbBalance);
        }

        if (tokenId == 0) {
            (uint160 sqrtRatioX96, , , , ,) = clPool.slot0();

            (uint256 mintedTokenId,,uint256 WETHAmountSupplied, uint256 OETHbAmountSupplied) = positionManager.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: OETHb,
                    tickSpacing: 1,
                    tickLower: 0,
                    tickUpper: 1,
                    amount0Desired: WETHBalance,
                    amount1Desired: OETHbRequired,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount0Min: 0,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    // needs to be 0 because the pool is already created
                    // non zero amount attempts to create a new instance of the pool
                    sqrtPriceX96: 0
                })
            );
            tokenId = mintedTokenId;
            netValue += WETHAmountSupplied + OETHbAmountSupplied;

            emit LiquidityAdded(
                WETHBalance, // WETHAmountDesired
                OETHbRequired, // OETHbAmountDesired
                WETHAmountSupplied, // WETHAmountSupplied
                OETHbAmountSupplied, // OETHbAmountSupplied
                mintedTokenId, // tokenId
                netValue
            );
        } else {

            (,uint256 WETHAmountSupplied, uint256 OETHbAmountSupplied) = positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId,
                    amount0Desired: WETHBalance,
                    amount1Desired: OETHbRequired,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount0Min: 0,
                    // we don't need slippage protection checking for that in _checkLiquidityWithinExpectedShare
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );

            netValue += WETHAmountSupplied + OETHbAmountSupplied;

            emit LiquidityAdded(
                WETHBalance, // WETHAmountDesired
                OETHbRequired, // OETHbAmountDesired
                WETHAmountSupplied, // WETHAmountSupplied
                OETHbAmountSupplied, // OETHbAmountSupplied
                tokenId, // tokenId
                netValue
            );
        }

        positionManager.approve(address(clGauge), tokenId);
        clGauge.deposit(tokenId);
    }

    /**
     * @notice Deposit all supported assets in this strategy contract to the platform
     */
    function depositAll()
        external
        override
        onlyVault
        nonReentrant 
    {
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
    ) 
        external
        override
        onlyVault
        nonReentrant
    {

    }

    /**
     * @notice Withdraw all supported assets from platform and
     * sends to the OToken's Vault.
     */
    function withdrawAll()
        external
        override
        onlyVault
        nonReentrant
    {
    }


    /**
     * @dev Collect the AERO token from the gauge 
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
     * @dev Approve the spending of all assets 
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

    /***************************************
            ERC721 management
    ****************************************/

    /// @notice Callback function for whenever a NFT is transferred to this contract
    // solhint-disable-next-line max-line-length
    /// Ref: https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Receiver-onERC721Received-address-address-uint256-bytes-
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
