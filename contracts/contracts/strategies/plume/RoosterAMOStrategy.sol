// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Rooster AMO strategy
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

import { IVault } from "../../interfaces/IVault.sol";
import { IMaverickV2Pool } from "../../interfaces/plume/IMaverickV2Pool.sol";
import { IMaverickV2Quoter } from "../../interfaces/plume/IMaverickV2Quoter.sol";
import { IMaverickV2LiquidityManager } from "../../interfaces/plume/IMaverickV2LiquidityManager.sol";
import { IMaverickV2PoolLens } from "../../interfaces/plume/IMaverickV2PoolLens.sol";
import { IMaverickV2Position } from "../../interfaces/plume/IMaverickV2Position.sol";
// importing custom version of rooster TickMath because of dependency collision. Maverick uses
// a newer OpenZepplin Math library with functionality that is not present in 4.4.2 (the one we use)
import { TickMath } from "../../../lib/rooster/v2-common/libraries/TickMath.sol";
import { ONE } from "../../../lib/rooster/v2-common/libraries/Constants.sol";
import { Math as Math_v2 } from "../../../lib/rooster/v2-common/libraries/Math.sol";

import "hardhat/console.sol";

contract RoosterAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice NFT tokenId of the liquidity position
    uint256 public tokenId;
    /// @dev Minimum amount of tokens the strategy would be able to withdraw from the pool.
    ///      minimum amount of tokens are withdrawn at a 1:1 price
    uint256 public underlyingAssets;
    /// @notice Marks the start of the interval that defines the allowed range of WETH share in
    /// the pre-configured pool's liquidity ticker
    uint256 public allowedWethShareStart;
    /// @notice Marks the end of the interval that defines the allowed range of WETH share in
    /// the pre-configured pool's liquidity ticker
    uint256 public allowedWethShareEnd;
    /// @dev reserved for inheritance
    int256[46] private __reserved;

    /***************************************
          Constants, structs and events
    ****************************************/

    /// @notice The address of the Wrapped ETH (WETH) token contract
    address public immutable WETH;
    /// @notice The address of the OETHp token contract
    address public immutable OETHp;
    /// @notice tick spacing of the pool (set to 1)
    int24 public immutable tickSpacing;
    /// @notice the underlying AMO Maverick pool
    IMaverickV2Pool public immutable mPool;
    /// @notice the Liquidity manager used to add liquidity to the mPool
    IMaverickV2LiquidityManager public immutable liquidityManager;
    /// @notice the Maverick V2 pool lens
    IMaverickV2PoolLens public immutable poolLens;
    /// @notice the Maverick V2 position
    IMaverickV2Position public immutable maverickPosition;
    /// @notice the Maverick Quoter
    IMaverickV2Quoter public immutable quoter;

    /// @notice sqrtPriceTickLower
    /// @dev tick lower represents the higher price of OETHp priced in WETH. Meaning the pool
    /// offers less than 1 OETHp for 1 WETH. In other terms to get 1 OETHp the swap needs to offer 1.0001 WETH
    /// this is where purchasing OETHp with WETH within the liquidity position is most expensive.
    /// TODO: I THINK THIS IS THE OTHER WAY AROUND
    ///
    /// Price is defined as price of token1 in terms of token0. (token1 / token0)
    uint256 public immutable sqrtPriceTickLower;
    /// @notice sqrtPriceTickHigher
    /// @dev tick higher represents 1:1 price parity of WETH to OETHp
    uint256 public immutable sqrtPriceTickHigher;
    /// @dev price at parity
    uint256 public immutable sqrtPriceAtParity;
    /// @notice The tick where the strategy deploys the liquidity to
    int32 public immutable tickNumber;

    /// @dev a threshold under which the contract no longer allows for the protocol to rebalance. Guarding
    ///      against a strategist / guardian being taken over and with multiple transactions draining the
    ///      protocol funds.
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    event PoolWethShareIntervalUpdated(
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    event LiquidityRemoved(
        uint256 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHbAmount,
        uint256 underlyingAssets
    );
    event PoolRebalanced(uint256 currentPoolWethShare);
    event UnderlyingAssetsUpdated(uint256 underlyingAssets);

    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    ); // 0x3681e8e0

    event LiquidityAdded(
        uint256 wethAmountDesired,
        uint256 oethbAmountDesired,
        uint256 wethAmountSupplied,
        uint256 oethbAmountSupplied,
        uint256 tokenId,
        uint256 underlyingAssets
    ); // 0x1530ec74

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth); // 0xa6737d87
    error OutsideExpectedTickRange(); // 0xa6e1bad2
    error SlippageCheck(uint256 tokenReceived); // 0x355cdb78
    error InsufficientTokenBalance(uint256 tokenOffered, uint256 tokenRequired, address token); // 0xe23d5ff7

    /**
     * @dev Verifies that the caller is the Governor, or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Not the Governor or Strategist"
        );
        _;
    }

    // TODO details of Rooster gauge system not yet clear
    /**
     * @dev Un-stakes the token from the gauge for the execution duration of
     * the function and after that re-stakes it back in.
     *
     * It is important that the token is unstaked and owned by the strategy contract
     * during any liquidity altering operations and that it is re-staked back into the
     * gauge after liquidity changes. If the token fails to re-stake back to the
     * gauge it is not earning incentives.
     */
    // all functions using this modifier are used by functions with reentrancy check
    // slither-disable-start reentrancy-no-eth
    modifier gaugeUnstakeAndRestake() {
        // TODO: we might not need this here
        //
        // // because of solidity short-circuit _isLpTokenStakedInGauge doesn't get called
        // // when tokenId == 0
        // if (tokenId != 0 && _isLpTokenStakedInGauge()) {
        //     clGauge.withdraw(tokenId);
        // }
        _;
        // // because of solidity short-circuit _isLpTokenStakedInGauge doesn't get called
        // // when tokenId == 0
        // if (tokenId != 0 && !_isLpTokenStakedInGauge()) {
        //     /**
        //      * It can happen that a withdrawal (or a full withdrawal) transactions would
        //      * remove all of the liquidity from the token with a NFT token still existing.
        //      * In that case the token can not be staked into the gauge, as some liquidity
        //      * needs to be added to it first.
        //      */
        //     if (_getLiquidity() > 0) {
        //         // if token liquidity changes the positionManager requires re-approval.
        //         // to any contract pre-approved to handle the token.
        //         positionManager.approve(address(clGauge), tokenId);
        //         clGauge.deposit(tokenId);
        //     }
        // }
    }

    /// @notice the constructor
    /// @dev This contract is intended to be used as a proxy. To prevent the
    ///      potential confusion of having a functional implementation contract
    ///      the constructor has the `initializer` modifier. This way the
    ///      `initialize` function can not be called on the implementation contract.
    ///      For the same reason the implementation contract also has the governor
    ///      set to a zero address.
    /// @param _stratConfig the basic strategy configuration
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _oethpAddress Address of the Erc20 OETHp Token contract
    /// @param _liquidityManager Address of liquidity manager to add
    ///         the liquidity
    /// @param _mPool Address of the Aerodrome concentrated liquidity pool
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _oethpAddress,
        address _liquidityManager,
        address _poolLens,
        address _maverickPosition,
        address _maverickQuoter,
        address _mPool,
        bool _upperTickAtParity
    ) initializer InitializableAbstractStrategy(_stratConfig) {
        require(
            address(IMaverickV2Pool(_mPool).tokenA()) == _wethAddress,
            "Only WETH supported as tokenA"
        );
        require(
            address(IMaverickV2Pool(_mPool).tokenB()) == _oethpAddress,
            "Only OETHp supported as tokenB"
        );
        require(
            _liquidityManager != address(0),
            "LiquidityManager zero address not allowed"
        );
        require(
            _maverickQuoter != address(0),
            "Quoter zero address not allowed"
        );
        require(_poolLens != address(0), "PoolLens zero address not allowed");
        require(
            _maverickPosition != address(0),
            "Position zero address not allowed"
        );

        uint256 _tickSpacing = IMaverickV2Pool(_mPool).tickSpacing();
        require(_tickSpacing == 1, "Unsupported tickSpacing");

        tickNumber = -1;

        // tickSpacing == 1
        (sqrtPriceTickLower, sqrtPriceTickHigher) = TickMath.tickSqrtPrices(
            _tickSpacing,
            tickNumber
        );
        sqrtPriceAtParity = _upperTickAtParity
            ? sqrtPriceTickHigher
            : sqrtPriceTickLower;

        WETH = _wethAddress;
        OETHp = _oethpAddress;
        liquidityManager = IMaverickV2LiquidityManager(_liquidityManager);
        poolLens = IMaverickV2PoolLens(_poolLens);
        maverickPosition = IMaverickV2Position(_maverickPosition);
        quoter = IMaverickV2Quoter(_maverickQuoter);
        mPool = IMaverickV2Pool(_mPool);

        require(address(mPool.tokenA()) == WETH, "WETH not TokanA");
        require(address(mPool.tokenB()) == OETHp, "OETHp not TokanB");

        // prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     */
    function initialize(address[] memory _rewardTokenAddresses)
        external
        onlyGovernor
        initializer
    {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            new address[](0),
            new address[](0)
        );
    }

    /***************************************
                  Configuration 
    ****************************************/

    /**
     * @notice Set allowed pool weth share interval. After the rebalance happens
     * the share of WETH token in the ticker needs to be withing the specifications
     * of the interval.
     *
     * @param _allowedWethShareStart Start of WETH share interval expressed as 18 decimal amount
     * @param _allowedWethShareEnd End of WETH share interval expressed as 18 decimal amount
     */
    function setAllowedPoolWethShareInterval(
        uint256 _allowedWethShareStart,
        uint256 _allowedWethShareEnd
    ) external onlyGovernor {
        require(
            _allowedWethShareStart < _allowedWethShareEnd,
            "Invalid interval"
        );
        // can not go below 1% weth share
        require(_allowedWethShareStart > 0.01 ether, "Invalid interval start");
        // can not go above 95% weth share
        require(_allowedWethShareEnd < 0.95 ether, "Invalid interval end");

        allowedWethShareStart = _allowedWethShareStart;
        allowedWethShareEnd = _allowedWethShareEnd;
        emit PoolWethShareIntervalUpdated(
            allowedWethShareStart,
            allowedWethShareEnd
        );
    }

    /***************************************
                Periphery utils
    ****************************************/

    // function _isLpTokenStakedInGauge() internal view returns (bool) {
    //     require(tokenId != 0, "Missing NFT LP token");

    //     address owner = positionManager.ownerOf(tokenId);
    //     require(
    //         owner == address(clGauge) || owner == address(this),
    //         "Unexpected token owner"
    //     );
    //     return owner == address(clGauge);
    // }

    /***************************************
               Strategy overrides 
    ****************************************/

    /**
     * @notice Deposits funds to the strategy which deposits them to the 
     * underlying Rooster pool if the pool price is within the expected interval.
     * @param _asset   Address for the asset
     * @param _amount  Units of asset to deposit
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
     * @notice Deposits all the funds to the strategy which deposits them to the 
     * underlying Rooster pool if the pool price is within the expected interval.
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        if (_wethBalance > 1e12) {
            _deposit(WETH, _wethBalance);
        }
    }

    /**
     * @dev Deposits funds to the strategy which deposits them to the 
     * underlying Rooster pool if the pool price is within the expected interval.
     * Before this function can be called the initial pool position needs to already
     * be minted.
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must deposit something");
        require(tokenId > 0, "Initial position not minted");
        emit Deposit(_asset, address(0), _amount);

        // if the pool price is not within the expected interval leave the WETH on the contract
        // as to not break the mints
        (bool _isExpectedRange, ) = _checkForExpectedPoolPrice(false);
        if (_isExpectedRange) {
            // deposit funds into the underlying pool. Because no swap is performed there is no
            // need to remove any of the liquidity beforehand.
            _rebalance(0, false, 0, 0);
        }
    }

    /**
     * @notice Withdraw an `amount` of WETH from the platform and
     *         send to the `_recipient`.
     * @param _recipient  Address to which the asset should be sent
     * @param _asset      WETH address
     * @param _amount     Amount of WETH to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_asset == WETH, "Unsupported asset");
        require(_amount > 0, "Must withdraw something");
        require(_recipient == vaultAddress, "Only withdraw to vault allowed");

        _ensureWETHBalance(_amount);

        _withdraw(_recipient, _amount);
    }

    /**
     * @notice Withdraw WETH and sends it to the Vault.
     */
    function withdrawAll() external override onlyVault nonReentrant {
        if (tokenId != 0) {
            _removeLiquidity(1e18);
        }

        uint256 _balance = IERC20(WETH).balanceOf(address(this));
        if (_balance > 0) {
            _withdraw(vaultAddress, _balance);
        }
    }

    function _withdraw(address _recipient, uint256 _amount) internal {
        IERC20(WETH).safeTransfer(_recipient, _amount);
        emit Withdrawal(WETH, address(0), _amount);
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /**
     * @dev Approve the spending of all assets
     */
    function _approveTokenAmounts(
        uint256 _wethAllowance,
        uint256 _oethBAllowance
    ) internal {
        IERC20(WETH).approve(address(liquidityManager), _wethAllowance);
        IERC20(OETHp).approve(address(liquidityManager), _oethBAllowance);
    }

    /**
     * @dev Perform a swap so that after the swap the tick has the desired WETH to OETHp token share.
     */
    function _swapToDesiredPosition(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        IERC20 _tokenToSwap = IERC20(_swapWeth ? WETH : OETHp);
        uint256 _balance = _tokenToSwap.balanceOf(address(this));

        if (_balance < _amountToSwap) {
            // This should never trigger since _ensureWETHBalance will already
            // throw an error if there is not enough WETH
            if (_swapWeth) {
                revert NotEnoughWethForSwap(_balance, _amountToSwap);
            }
            // if swapping OETHp
            uint256 mintForSwap = _amountToSwap - _balance;
            IVault(vaultAddress).mintForStrategy(mintForSwap);
        }

        if (_swapWeth) {
            IERC20(WETH).transfer(address(mPool), _amountToSwap);
        } else {
            IERC20(OETHp).transfer(address(mPool), _amountToSwap);
        }

        IMaverickV2Pool.SwapParams memory swapParams = IMaverickV2Pool
            .SwapParams({
                amount: _amountToSwap,
                tokenAIn: _swapWeth,
                exactOutput: false,
                tickLimit: tickNumber
            });

        // swaps without a callback as the assets are already sent to the pool
        (, uint256 amountOut) = mPool.swap(
            address(this),
            swapParams,
            bytes("")
        );

        if (amountOut < _minTokenReceived) {
            revert SlippageCheck(amountOut);
        }

        /**
         * In the interest of each function in _rebalance to leave the contract state as
         * clean as possible the OETHp tokens here are burned. This decreases the
         * dependence where `_swapToDesiredPosition` function relies on later functions
         * (`addLiquidity`) to burn the OETHp. Reducing the risk of error introduction.
         */
        _burnOethOnTheContract(false);
    }

    /***************************************
              Liquidity management
    ****************************************/

    /// @dev creates add liquidity view input params with default values. The `targetAmount` & `targetIsA` need to be
    ///      overridden
    function _createAddLiquidityParams()
        internal
        view
        returns (IMaverickV2PoolLens.AddParamsViewInputs memory)
    {
        int32[] memory ticks = new int32[](1);
        uint128[] memory relativeLiquidityAmounts = new uint128[](1);
        // only 1 tick is having liquidity added
        ticks[0] = tickNumber;
        // all liquidity into one tick
        relativeLiquidityAmounts[0] = 1e18;

        IMaverickV2PoolLens.AddParamsSpecification
            memory addSpec = IMaverickV2PoolLens.AddParamsSpecification({
                // no slippage required as all liquidity is going to 1 tick
                slippageFactorD18: 0,
                numberOfPriceBreaksPerSide: 0,
                targetAmount: 1e18, // is altered later
                targetIsA: false // is altered later
            });

        return
            IMaverickV2PoolLens.AddParamsViewInputs({
                pool: mPool,
                kind: 0, // static kind
                ticks: ticks,
                relativeLiquidityAmounts: relativeLiquidityAmounts,
                addSpec: addSpec
            });
    }

    /**
     * @dev Add liquidity into the pool in the pre-configured WETH to OETHp share ratios
     * defined by the allowedPoolWethShareStart|End interval.
     *
     * Rooster's PoolLens contract is can be slightly off when calculating the required WETH &
     * OETHp the Pool will spend when adding the liquidity. In tests the error didn't exceed
     * the `amount/1e12` where the `amount` is the limit/target value passed to the PoolLens
     * when creating the addParams. Unfortunately the error can happen in any direction (it can
     * go above the target amount as well as under).
     *
     * To mitigate this issue strategy corrects for a larger `amount / 1e9` portion of the amount
     * intending to be deposited in the following manner:
     *  - the WETH limit given to the PoolLens contract is adjusted down for the error. The
     *    amount of WETH approved to be transferred is not adjusted - if Pool transfers out
     *    more WETH than predicted.
     *  - the amount of OETHp approved to be transferred is adjusted up for the error. As the
     *    PoolLens can under-estimate the amount it reports back.
     *
     * This way the add liquidity transaction should succeed even in the worst case where the
     * PoolLens underestimated the transferred WETH & transferred OETHp.
     *
     * As a more readable error reporting measure Rooster Quoter contract is used (which doesn't
     * have calculation issues) to verify the WETH & OETHp amounts and throws an error when
     * the pool would still transfer larger amount of tokens than approve by this contract.
     */
    function _addLiquidity() internal gaugeUnstakeAndRestake {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 _oethBalance = IERC20(OETHp).balanceOf(address(this));
        // don't deposit small liquidity amounts
        if (_wethBalance <= 1e12) {
            return;
        }

        uint256 _wethBalanceAdjustedDown = _adjustForRoosterMathError(_wethBalance, true);
        (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            IMaverickV2Pool.AddLiquidityParams[] memory addParams,
            IMaverickV2PoolLens.TickDeltas memory tickDelta
        ) = _getAddLiquidityParams(_wethBalanceAdjustedDown, 0);

        uint256 _oethRequired = tickDelta.deltaBOut;
        uint256 _oethRequiredAdjustedUp = _adjustForRoosterMathError(_oethRequired, false);
        if (_oethRequiredAdjustedUp > _oethBalance) {
            IVault(vaultAddress).mintForStrategy(_oethRequiredAdjustedUp - _oethBalance);
        }

        _approveTokenAmounts(_wethBalance, _oethRequiredAdjustedUp);
        _verifyAddLiquidityAmountsRequired(_wethBalance, _oethRequiredAdjustedUp, addParams[0]);

        /* Adding of the liquidity removes less tokens than `tickDelta` returned
         * by the pools lens reports. For that reason some dust WETH and OETH will
         * remain on the contract after adding the liquidity
         */
        (uint256 _wethAmount, uint256 _oethAmount, ) = liquidityManager
            .addPositionLiquidityToSenderByTokenIndex(
                mPool,
                0, // NFT token index
                packedSqrtPriceBreaks,
                packedArgs
            );

        _updateUnderlyingAssets();

        emit LiquidityAdded(
            _wethBalanceAdjustedDown, // wethAmountDesired
            _oethRequired, // oethpAmountDesired
            _wethAmount, // wethAmountSupplied
            _oethAmount, // oethbAmountSupplied
            tokenId, // tokenId
            underlyingAssets
        );

        // burn remaining OETHp and skip check because liquidityManager takes
        // a little bit less tokens than lens contract calculates when creating
        // the add liquidity parameters
        _burnOethOnTheContract(true);
    }

    /**
     * PoolLens contract isn't precise when calculating the token amounts required when adding
     * liquidity. On the other hand the Quoter contract is. There is some buffer included in amounts
     * passed to PoolLens contract. This function checks the quoter values and throws and error in 
     * case the buffer isn't sufficient.
     * 
     */
    function _verifyAddLiquidityAmountsRequired(
        uint256 _wethAvailable,
        uint256 _oethAvailable,
        IMaverickV2Pool.AddLiquidityParams memory addParams
    ) internal {
        (uint256 _wethQuoted, uint256 _oethPQuoted, ) = quoter.calculateAddLiquidity(mPool, addParams);
        if (_wethQuoted > _wethAvailable) {
            revert InsufficientTokenBalance(_wethAvailable, _wethQuoted, WETH);
        }
        if (_oethPQuoted > _oethAvailable) {
            revert InsufficientTokenBalance(_oethAvailable, _oethPQuoted, OETHp);
        }
    }

    /**
     * When rooster's PooLens contract is calculating the presumed WETH & OETHp amounts the pool
     * contract will transfer considering given addLiquidity parameters it can make up to
     * 1e6 error on a 1e18 amounts added.
     * This function takes some extra buffer and corrects a 1e18 amount by 1e9. A 1e20 amount is
     * corrected by 1e11.
     */
    function _adjustForRoosterMathError(uint256 amount, bool adjustDown) internal pure returns (uint256) {
        return adjustDown ? amount - amount / 1e9 : amount + amount / 1e9;
    }

    // TODO: docs
    // slither-disable-end reentrancy-no-eth
    function _getAddLiquidityParams(uint256 maxWETH, uint256 maxOETHp)
        internal
        returns (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            IMaverickV2Pool.AddLiquidityParams[] memory addParams,
            IMaverickV2PoolLens.TickDeltas memory tickDelta
        )
    {
        IMaverickV2Pool.TickState memory tickState = mPool.getTick(tickNumber);
        IMaverickV2PoolLens.AddParamsViewInputs
            memory params = _createAddLiquidityParams();
        IMaverickV2PoolLens.TickDeltas[] memory tickDeltas;

        // tick has no WETH liquidity
        if (tickState.reserveA == 0) {
            params.addSpec.targetAmount = maxOETHp;
            params.addSpec.targetIsA = false;
            (
                packedSqrtPriceBreaks,
                packedArgs,
                ,
                addParams,
                tickDeltas
            ) = poolLens.getAddLiquidityParams(params);
        // tick has no OETHp liquidity
        } else if (tickState.reserveB == 0) {
            // we only need to check targetIsA = true
            params.addSpec.targetAmount = maxWETH;
            params.addSpec.targetIsA = true;
            (
                packedSqrtPriceBreaks,
                packedArgs,
                ,
                addParams,
                tickDeltas
            ) = poolLens.getAddLiquidityParams(params);
        // tick has liquidity of both tokens
        } else {
            // we need to check both
            params.addSpec.targetAmount = maxWETH;
            params.addSpec.targetIsA = true;
            (
                packedSqrtPriceBreaks,
                packedArgs,
                ,
                addParams,
                tickDeltas
            ) = poolLens.getAddLiquidityParams(params);
            // if maxOETHp == 0 then max limit is not given and will let the pool calculate required amount
            // of OETHp required depending on the tick weth share. Before this call the strategy contract needs to
            // verify that the pool price is in the expected range.
            if (tickDeltas[0].deltaBOut > maxOETHp && maxOETHp != 0) {
                // we know the params didn't meet out max spec.  we are asking for more OETHp than we want to spend.
                // do the call again with OETHp as the target.
                params.addSpec.targetAmount = maxOETHp;
                params.addSpec.targetIsA = false;
                (
                    packedSqrtPriceBreaks,
                    packedArgs,
                    ,
                    addParams,
                    tickDeltas
                ) = poolLens.getAddLiquidityParams(params);
            }
        }
        require(tickDeltas.length == 1, "Unexpected tickDeltas length");
        // pick the tick delta that was called last
        tickDelta = tickDeltas[0];
    }

    /**
     * @dev Check that the Rooster pool price is within the expected
     *      parameters.
     *      This function works whether the strategy contract has liquidity
     *      position in the pool or not. The function returns _wethSharePct
     *      as a gas optimization measure.
     * @param throwException  when set to true the function throws an exception
     *        when pool's price is not within expected range.
     * @return _isExpectedRange  Bool expressing price is within expected range
     * @return _wethSharePct  Share of WETH owned by this strategy contract in the
     *         configured ticker.
     */
    function _checkForExpectedPoolPrice(bool throwException)
        internal
        view
        returns (bool _isExpectedRange, uint256 _wethSharePct)
    {
        require(
            allowedWethShareStart != 0 && allowedWethShareEnd != 0,
            "Weth share interval not set"
        );

        uint256 _currentPrice = getPoolSqrtPrice();

        /**
         * First check pool price is in expected tick range
         *
         * A revert is issued even though price being equal to the lower bound as that can not
         * be within the approved tick range.
         */
        if (
            _currentPrice <= sqrtPriceTickLower ||
            _currentPrice >= sqrtPriceTickHigher
        ) {
            if (throwException) {
                revert OutsideExpectedTickRange();
            }
            return (false, 0);
        }

        // 18 decimal number expressed WETH tick share
        _wethSharePct = _getWethShare(_currentPrice);

        if (
            _wethSharePct < allowedWethShareStart ||
            _wethSharePct > allowedWethShareEnd
        ) {
            if (throwException) {
                revert PoolRebalanceOutOfBounds(
                    _wethSharePct,
                    allowedWethShareStart,
                    allowedWethShareEnd
                );
            }
            return (false, _wethSharePct);
        }

        return (true, _wethSharePct);
    }

    /**
     * @notice Rebalance the pool to the desired token split and Deposit any WETH on the contract to the
     * underlying rooster pool. Print the required amount of corresponding OETHp. After the rebalancing is
     * done burn any potentially remaining OETHp tokens still on the strategy contract.
     *
     * This function has a slightly different behaviour depending on the status of the underlying Rooster
     * pool. The function consists of the following 3 steps:
     * 1. withdrawLiquidityOption -> this is a configurable option where either only part of the liquidity
     *                               necessary for the swap is removed, or all of it. This way the rebalance
     *                               is able to optimize for volume, for efficiency or anything in between
     * 2. swapToDesiredPosition   -> move active trading price in the pool to be able to deposit WETH & OETHp
     *                               tokens with the desired pre-configured ratios
     * 3. addLiquidity            -> add liquidity into the pool respecting ratio split configuration
     *
     *
     * Exact _amountToSwap, _swapWeth & _minTokenReceived parameters shall be determined by simulating the
     * transaction off-chain. The strategy checks that after the swap the share of the tokens is in the
     * expected ranges.
     *
     * @param _amountToSwap The amount of the token to swap
     * @param _swapWeth Swap using WETH when true, use OETHb when false
     * @param _minTokenReceived Slippage check -> minimum amount of token expected in return
     * @param _liquidityToRemovePct Percentage of liquidity to remove -> the percentage amount of liquidity to
     *        remove before performing the swap. 1e18 denominated
     */
    function rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived,
        uint256 _liquidityToRemovePct
    ) external nonReentrant onlyGovernorOrStrategist {
        _rebalance(
            _amountToSwap,
            _swapWeth,
            _minTokenReceived,
            _liquidityToRemovePct
        );
    }

    function _rebalance(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived,
        uint256 _liquidityToRemovePct
    ) internal {
        // Remove the required amount of liquidity
        if (_liquidityToRemovePct > 0) {
            _removeLiquidity(_liquidityToRemovePct);
        }

        // In case liquidity has been removed and there is still not enough WETH owned by the 
        // strategy contract remove additional required amount of WETH.
        if (_swapWeth && _amountToSwap > 0) {
            _ensureWETHBalance(_amountToSwap);
        }

        // in some cases (e.g. deposits) we will just want to add liquidity and not
        // issue a swap to move the active trading position within the pool
        if (_amountToSwap > 0) {
            _swapToDesiredPosition(_amountToSwap, _swapWeth, _minTokenReceived);
        }
        // calling check liquidity early so we don't get unexpected errors when adding liquidity
        // in the later stages of this function
        _checkForExpectedPoolPrice(true);

        _addLiquidity();

        // this call shouldn't be necessary, since adding liquidity shouldn't affect the active
        // trading price. It is a defensive programming measure.
        (, uint256 _wethSharePct) = _checkForExpectedPoolPrice(true);

        // revert if protocol insolvent
        _solvencyAssert();

        emit PoolRebalanced(_wethSharePct);
    }

    /**
     * @dev This function removes the appropriate amount of liquidity to assure that the required
     * amount of WETH is available on the contract
     *
     * @param _amount  WETH balance required on the contract
     */
    function _ensureWETHBalance(uint256 _amount) internal {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        if (_wethBalance >= _amount) {
            return;
        }

        require(tokenId != 0, "No liquidity available");
        uint256 _additionalWethRequired = _amount - _wethBalance;
        (uint256 _wethInThePool, ) = getPositionPrincipal();

        if (_wethInThePool < _additionalWethRequired) {
            revert NotEnoughWethLiquidity(
                _wethInThePool,
                _additionalWethRequired
            );
        }

        uint256 shareOfWethToRemove = Math.min(
            _additionalWethRequired.divPrecisely(_wethInThePool) + 1,
            1e18
        );
        _removeLiquidity(shareOfWethToRemove);
    }

    /**
     * @dev Decrease partial or all liquidity from the pool.
     * @param _liquidityToDecrease The amount of liquidity to remove denominated in 1e18
     */
    function _removeLiquidity(uint256 _liquidityToDecrease)
        internal
        gaugeUnstakeAndRestake
    {
        require(_liquidityToDecrease > 0, "Must remove some liquidity");
        require(
            _liquidityToDecrease <= 1e18,
            "Can not remove more than 100% of liquidity"
        );

        IMaverickV2Pool.RemoveLiquidityParams memory params = maverickPosition
            .getRemoveParams(tokenId, 0, _liquidityToDecrease);
        (uint256 _amountWeth, uint256 _amountOethp) = maverickPosition
            .removeLiquidityToSender(tokenId, mPool, params);

        _updateUnderlyingAssets();

        emit LiquidityRemoved(
            _liquidityToDecrease,
            _amountWeth,
            _amountOethp,
            underlyingAssets
        );

        _burnOethOnTheContract(false);
    }

    /// @dev TODO: how are fees / tokens collected???
    /// This function assumes there are no uncollected tokens in the clPool owned by the strategy contract.
    ///      For that reason any liquidity withdrawals must also collect the tokens.
    function _updateUnderlyingAssets() internal {
        if (tokenId == 0) {
            underlyingAssets = 0;
            emit UnderlyingAssetsUpdated(underlyingAssets);
            return;
        }

        /**
         * Our net value represent the smallest amount of tokens we are able to extract from the position
         * given our liquidity.
         *
         * The least amount of tokens ex-tractable from the position is where the active trading price is
         * at the edge between tick -1 & tick 0. There the pool is offering 1:1 trades between WETH & OETHp.
         * At that moment the pool consists completely of WETH and no OETHp.
         *
         * The more swaps from OETHp -> WETH happen on the pool the more the price starts to move away from the tick 0
         * towards the middle of tick -1 making OETHp (priced in WETH) more expensive.
         *
         * An additional note: TODO: test what happens when liquidity is near zero or 0
         *
         * TODO: did we get this wrong with Aerodrome?
         */

        uint256 _wethAmount = _balanceInPosition();

        underlyingAssets = _wethAmount;
        emit UnderlyingAssetsUpdated(underlyingAssets);
    }

    /**
     * Burns any OETHp tokens remaining on the strategy contract
     */
    function _burnOethOnTheContract(bool skipCheck) internal {
        uint256 _oethpBalance = IERC20(OETHp).balanceOf(address(this));
        if (_oethpBalance > 1e12 || skipCheck) {
            IVault(vaultAddress).burnForStrategy(_oethpBalance);
        }
    }

    /**
     * @dev Returns the share of WETH in tick denominated in 1e18
     */
    function _getWethShare(uint256 _currentPrice)
        internal
        view
        returns (uint256)
    {
        (
            uint256 wethAmount,
            uint256 oethpAmount
        ) = _reservesInTickForGivenPriceAndLiquidity(
            sqrtPriceTickLower,
            sqrtPriceTickHigher,
            _currentPrice,
            1e24
        );

        // upscale to get 1e18 denomination after division
        uint256 wethAmountUp = wethAmount * 1e18;
        uint256 oethpAmountUp = oethpAmount * 1e18;

        return wethAmountUp.divPrecisely(wethAmountUp + oethpAmountUp);
    }

    /**
     * @notice Returns the current pool price in square root
     * @return Square root of the pool price
     */
    function getPoolSqrtPrice() public view returns (uint256) {
        return poolLens.getPoolSqrtPrice(mPool);
    }

    /**
     * @notice Returns the current active trading tick of the underlying pool
     * @return _currentTick Current pool trading tick
     */
    function getCurrentTradingTick() public view returns (int32 _currentTick) {
        _currentTick = mPool.getState().activeTick;
    }

    /**
     * @notice Mint the initial NFT position
     */
    function mintInitialPosition() external onlyGovernor nonReentrant {
        (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            ,
            IMaverickV2PoolLens.TickDeltas memory tickDelta
        ) = _getAddLiquidityParams(1e18, 1e18);
        // Mint amount of OETH required
        IVault(vaultAddress).mintForStrategy(tickDelta.deltaBOut);

        _approveTokenAmounts(1e18, 1e18);
        (, , , uint256 _tokenId) = liquidityManager.mintPositionNftToSender(
            mPool,
            packedSqrtPriceBreaks,
            packedArgs
        );
        // burn remaining OETHp
        _burnOethOnTheContract(true);
        _updateUnderlyingAssets();
        _approveTokenAmounts(0, 0);

        // Store the tokenId
        tokenId = _tokenId;
    }

    /**
     * @dev Returns the balance of both tokens in a given position (TODO does it include fees?)
     * @return _amountWeth Amount of WETH in position
     * @return _amountOethp Amount of OETHp in position
     */
    function getPositionPrincipal()
        public
        view
        returns (uint256 _amountWeth, uint256 _amountOethp)
    {
        if (tokenId == 0) {
            return (0, 0);
        }

        (_amountWeth, _amountOethp, ) = _getPositionInformation();
    }

    function _getPositionInformation()
        internal
        view
        returns (
            uint256 _amountWeth,
            uint256 _amountOethp,
            uint256 liquidity
        )
    {
        IMaverickV2Position.PositionFullInformation
            memory positionInfo = maverickPosition.tokenIdPositionInformation(
                tokenId,
                0
            );

        require(
            positionInfo.liquidities.length == 1,
            "Unexpected liquidities length"
        );
        require(positionInfo.ticks.length == 1, "Unexpected ticks length");

        _amountWeth = positionInfo.amountA;
        _amountOethp = positionInfo.amountB;
        liquidity = positionInfo.liquidities[0];
    }

    /**
     * Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99,8 %) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view {
        uint256 _totalVaultValue = IVault(vaultAddress).totalValue();
        uint256 _totalOethpSupply = IERC20(OETHp).totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOethpSupply) <
            SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
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
        require(_asset == WETH, "Only WETH supported");

        // just in case there is some WETH in the strategy contract
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        // just paranoia check, in case there is OETHb in the strategy that for some reason hasn't
        // been burned yet.
        uint256 _oethpBalance = IERC20(OETHp).balanceOf(address(this));
        return underlyingAssets + _wethBalance + _oethpBalance;
    }

    /**
     * @notice Strategy reserves (which consist only of WETH in case of Rooster - Plume pool)
     * when the tick price is closest to parity - assuring the lowest amount of tokens
     * returned for the current position liquidity.
     */
    function _balanceInPosition() internal view returns (uint256 _wethBalance) {
        (, , uint256 liquidity) = _getPositionInformation();

        uint256 _oethbBalance;

        (
            _wethBalance,
            _oethbBalance
        ) = _reservesInTickForGivenPriceAndLiquidity(
            sqrtPriceTickLower,
            sqrtPriceTickHigher,
            sqrtPriceAtParity,
            liquidity
        );

        require(_oethbBalance == 0, "Non zero oethbBalance");
    }

    /**
     * @notice Tick dominance denominated in 1e18
     *
     */
    function tickDominance() public view returns (uint256 _tickDominance) {
        uint256 _currentPrice = getPoolSqrtPrice();
        (
            IMaverickV2Pool.TickState memory tickState,
            ,

        ) = _reservesInTickForGivenPrice(tickNumber, _currentPrice);

        uint256 wethReserve = tickState.reserveA;
        uint256 oethpReserve = tickState.reserveB;

        (
            uint256 _amountWeth,
            uint256 _amountOethp,

        ) = _getPositionInformation();

        if ((wethReserve + oethpReserve) > 0) {
            _tickDominance = (_amountWeth + _amountOethp).divPrecisely(
                wethReserve + oethpReserve
            );
        } else {
            return 0;
        }
    }

    /***************************************
            Hidden functions
    ****************************************/
    /// @inheritdoc InitializableAbstractStrategy
    function setPTokenAddress(address, address) external pure override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function removePToken(uint256) external pure override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /**
     * @dev Not supported
     */
    function _abstractSetPToken(address, address) internal pure override {
        revert("Unsupported method");
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
        // all the amounts are approved at the time required
        revert("Unsupported method");
    }

    /***************************************
          Maverick liquidity utilities
    ****************************************/

    /**
     * @notice Calculates deltaA = liquidity * (sqrt(upper) - sqrt(lower))
     *  Calculates deltaB = liquidity / sqrt(lower) - liquidity / sqrt(upper),
     *  i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
     *
     * @dev refactored from here:
     * https://github.com/rooster-protocol/rooster-contracts/blob/main/v2-supplemental/contracts/libraries/LiquidityUtilities.sol#L665-L695
     */
    function _reservesInTickForGivenPriceAndLiquidity(
        uint256 lowerSqrtPrice,
        uint256 upperSqrtPrice,
        uint256 newSqrtPrice,
        uint256 liquidity
    ) internal view returns (uint128 reserveA, uint128 reserveB) {
        if (liquidity == 0) {
            (reserveA, reserveB) = (0, 0);
        } else {
            uint256 lowerEdge = Math_v2.max(lowerSqrtPrice, newSqrtPrice);

            reserveA = Math_v2
                .mulCeil(
                    liquidity,
                    Math_v2.clip(
                        Math_v2.min(upperSqrtPrice, newSqrtPrice),
                        lowerSqrtPrice
                    )
                )
                .toUint128();
            reserveB = Math_v2
                .mulDivCeil(
                    liquidity,
                    ONE * Math_v2.clip(upperSqrtPrice, lowerEdge),
                    upperSqrtPrice * lowerEdge
                )
                .toUint128();
        }
    }

    /**
     * @notice Calculates deltaA = liquidity * (sqrt(upper) - sqrt(lower))
     *  Calculates deltaB = liquidity / sqrt(lower) - liquidity / sqrt(upper),
     *  i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
     *
     * @dev refactored from here:
     * https://github.com/rooster-protocol/rooster-contracts/blob/main/v2-supplemental/contracts/libraries/LiquidityUtilities.sol#L665-L695
     */
    function _reservesInTickForGivenPrice(
        int32 tick,
        uint256 newSqrtPrice
    )
        internal
        view
        returns (
            IMaverickV2Pool.TickState memory tickState,
            bool tickLtActive,
            bool tickGtActive
        )
    {
        tickState = mPool.getTick(tick);
        (uint256 lowerSqrtPrice, uint256 upperSqrtPrice) = TickMath
            .tickSqrtPrices(mPool.tickSpacing(), tick);

        tickGtActive = newSqrtPrice < lowerSqrtPrice;
        tickLtActive = newSqrtPrice >= upperSqrtPrice;

        uint256 liquidity = TickMath.getTickL(
            tickState.reserveA,
            tickState.reserveB,
            lowerSqrtPrice,
            upperSqrtPrice
        );

        (
            tickState.reserveA,
            tickState.reserveB
        ) = _reservesInTickForGivenPriceAndLiquidity(
            lowerSqrtPrice,
            upperSqrtPrice,
            newSqrtPrice,
            liquidity
        );
    }
}
