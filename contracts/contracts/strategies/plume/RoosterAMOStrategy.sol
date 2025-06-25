// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Rooster AMO strategy
 * @author Origin Protocol Inc
 */
import { Math as MathRooster } from "../../../lib/rooster/v2-common/libraries/Math.sol";
import { Math as Math_v5 } from "../../../lib/rooster/openzeppelin-custom/contracts/utils/math/Math.sol";
import { StableMath } from "../../utils/StableMath.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IMaverickV2Pool } from "../../interfaces/plume/IMaverickV2Pool.sol";
import { IMaverickV2Quoter } from "../../interfaces/plume/IMaverickV2Quoter.sol";
import { IMaverickV2LiquidityManager } from "../../interfaces/plume/IMaverickV2LiquidityManager.sol";
import { IMaverickV2PoolLens } from "../../interfaces/plume/IMaverickV2PoolLens.sol";
import { IMaverickV2Position } from "../../interfaces/plume/IMaverickV2Position.sol";
import { IVotingDistributor } from "../../interfaces/plume/IVotingDistributor.sol";
import { IPoolDistributor } from "../../interfaces/plume/IPoolDistributor.sol";
// importing custom version of rooster TickMath because of dependency collision. Maverick uses
// a newer OpenZepplin Math library with functionality that is not present in 4.4.2 (the one we use)
import { TickMath } from "../../../lib/rooster/v2-common/libraries/TickMath.sol";

contract RoosterAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /***************************************
            Storage slot members
    ****************************************/

    /// @notice NFT tokenId of the liquidity position
    ///
    /// @dev starts with value of 1 and can not be 0
    //  solhint-disable-next-line max-line-length
    ///      https://github.com/rooster-protocol/rooster-contracts/blob/fbfecbc519e4495b12598024a42630b4a8ea4489/v2-common/contracts/base/Nft.sol#L14
    uint256 public tokenId;
    /// @dev Minimum amount of tokens the strategy would be able to withdraw from the pool.
    ///      minimum amount of tokens are withdrawn at a 1:1 price
    ///      Important: Underlying assets contains only assets that are deposited in the underlying Rooster pool.
    ///      WETH or OETH held by this contract is not accounted for in underlying assets
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
    /// @notice The address of the OETH token contract
    address public immutable OETH;
    /// @notice the underlying AMO Maverick (Rooster) pool
    IMaverickV2Pool public immutable mPool;
    /// @notice the Liquidity manager used to add liquidity to the pool
    IMaverickV2LiquidityManager public immutable liquidityManager;
    /// @notice the Maverick V2 poolLens
    ///
    /// @dev only used to provide the pool's current sqrtPrice
    IMaverickV2PoolLens public immutable poolLens;
    /// @notice the Maverick V2 position
    ///
    /// @dev provides details of the NFT LP position and offers functions to
    /// remove the liquidity.
    IMaverickV2Position public immutable maverickPosition;
    /// @notice the Maverick Quoter
    IMaverickV2Quoter public immutable quoter;
    /// @notice the Maverick Voting Distributor
    IVotingDistributor public immutable votingDistributor;
    /// @notice the Maverick Pool Distributor
    IPoolDistributor public immutable poolDistributor;

    /// @notice sqrtPriceTickLower
    /// @dev tick lower represents the lower price of OETH priced in WETH. Meaning the pool
    /// offers more than 1 OETH for 1 WETH. In other terms to get 1 OETH the swap needs to offer 0.9999 WETH
    /// this is where purchasing OETH with WETH within the liquidity position is the cheapest.
    ///
    ///            _____________________
    ///            |      |            |
    ///            | WETH |    OETH   |
    ///            |      |            |
    ///            |      |            |
    ///  --------- * ---- * ---------- * ---------
    ///               currentPrice
    ///                          sqrtPriceHigher-(1:1 parity)
    ///      sqrtPriceLower
    ///
    ///
    /// Price is defined as price of token1 in terms of token0. (token1 / token0)
    /// @notice sqrtPriceTickLower - OETH is priced 0.9999 WETH
    uint256 public immutable sqrtPriceTickLower;
    /// @notice sqrtPriceTickHigher
    /// @dev tick higher represents 1:1 price parity of WETH to OETH
    uint256 public immutable sqrtPriceTickHigher;
    /// @dev price at parity (in OETH this is equal to sqrtPriceTickHigher)
    uint256 public immutable sqrtPriceAtParity;
    /// @notice The tick where the strategy deploys the liquidity to
    int32 public constant TICK_NUMBER = -1;
    /// @notice Minimum liquidity that must be exceeded to continue with the action
    /// e.g. deposit, add liquidity
    uint256 public constant ACTION_THRESHOLD = 1e12;
    /// @notice Maverick pool static liquidity bin type
    uint8 public constant MAV_STATIC_BIN_KIND = 0;
    /// @dev a threshold under which the contract no longer allows for the protocol to rebalance. Guarding
    ///      against a strategist / guardian being taken over and with multiple transactions draining the
    ///      protocol funds.
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;
    /// @notice Emitted when the allowed interval within which the strategy contract is allowed to deposit
    /// liquidity to the underlying pool is updated.
    /// @param allowedWethShareStart The start of the interval
    /// @param allowedWethShareEnd The end of the interval
    event PoolWethShareIntervalUpdated(
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    );
    /// @notice Emitted when liquidity is removed from the underlying pool
    /// @param withdrawLiquidityShare Share of strategy's liquidity that has been removed
    /// @param removedWETHAmount The amount of WETH removed
    /// @param removedOETHAmount The amount of OETH removed
    /// @param underlyingAssets Updated amount of strategy's underlying assets
    event LiquidityRemoved(
        uint256 withdrawLiquidityShare,
        uint256 removedWETHAmount,
        uint256 removedOETHAmount,
        uint256 underlyingAssets
    );

    /// @notice Emitted when the underlying pool is rebalanced
    /// @param currentPoolWethShare The resulting share of strategy's liquidity
    /// in the TICK_NUMBER
    event PoolRebalanced(uint256 currentPoolWethShare);

    /// @notice Emitted when the amount of underlying assets the strategy hold as
    /// liquidity in the pool is updated.
    /// @param underlyingAssets Updated amount of strategy's underlying assets
    event UnderlyingAssetsUpdated(uint256 underlyingAssets);

    /// @notice Emitted when liquidity is added to the underlying pool
    /// @param wethAmountDesired Amount of WETH desired to be deposited
    /// @param oethAmountDesired Amount of OETH desired to be deposited
    /// @param wethAmountSupplied Amount of WETH deposited
    /// @param oethAmountSupplied Amount of OETH deposited
    /// @param tokenId NFT liquidity token id
    /// @param underlyingAssets Updated amount of underlying assets
    event LiquidityAdded(
        uint256 wethAmountDesired,
        uint256 oethAmountDesired,
        uint256 wethAmountSupplied,
        uint256 oethAmountSupplied,
        uint256 tokenId,
        uint256 underlyingAssets
    ); // 0x1530ec74

    error PoolRebalanceOutOfBounds(
        uint256 currentPoolWethShare,
        uint256 allowedWethShareStart,
        uint256 allowedWethShareEnd
    ); // 0x3681e8e0

    error NotEnoughWethForSwap(uint256 wethBalance, uint256 requiredWeth); // 0x989e5ca8
    error NotEnoughWethLiquidity(uint256 wethBalance, uint256 requiredWeth); // 0xa6737d87
    error OutsideExpectedTickRange(); // 0xa6e1bad2
    error SlippageCheck(uint256 tokenReceived); // 0x355cdb78

    /// @notice the constructor
    /// @dev This contract is intended to be used as a proxy. To prevent the
    ///      potential confusion of having a functional implementation contract
    ///      the constructor has the `initializer` modifier. This way the
    ///      `initialize` function can not be called on the implementation contract.
    ///      For the same reason the implementation contract also has the governor
    ///      set to a zero address.
    /// @param _stratConfig the basic strategy configuration
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _oethAddress Address of the Erc20 OETH Token contract
    /// @param _liquidityManager Address of liquidity manager to add
    ///         the liquidity
    /// @param _poolLens Address of the pool lens contract
    /// @param _maverickPosition Address of the Maverick's position contract
    /// @param _maverickQuoter Address of the Maverick's Quoter contract
    /// @param _mPool Address of the Rooster concentrated liquidity pool
    /// @param _upperTickAtParity Bool when true upperTick is the one where the
    ///        price of OETH and WETH are at parity
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _oethAddress,
        address _liquidityManager,
        address _poolLens,
        address _maverickPosition,
        address _maverickQuoter,
        address _mPool,
        bool _upperTickAtParity,
        address _votingDistributor,
        address _poolDistributor
    ) initializer InitializableAbstractStrategy(_stratConfig) {
        require(
            address(IMaverickV2Pool(_mPool).tokenA()) == _wethAddress,
            "WETH not TokenA"
        );
        require(
            address(IMaverickV2Pool(_mPool).tokenB()) == _oethAddress,
            "OETH not TokenB"
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
        require(
            _votingDistributor != address(0),
            "Voting distributor zero address not allowed"
        );
        require(
            _poolDistributor != address(0),
            "Pool distributor zero address not allowed"
        );

        uint256 _tickSpacing = IMaverickV2Pool(_mPool).tickSpacing();
        require(_tickSpacing == 1, "Unsupported tickSpacing");

        // tickSpacing == 1
        (sqrtPriceTickLower, sqrtPriceTickHigher) = TickMath.tickSqrtPrices(
            _tickSpacing,
            TICK_NUMBER
        );
        sqrtPriceAtParity = _upperTickAtParity
            ? sqrtPriceTickHigher
            : sqrtPriceTickLower;

        WETH = _wethAddress;
        OETH = _oethAddress;
        liquidityManager = IMaverickV2LiquidityManager(_liquidityManager);
        poolLens = IMaverickV2PoolLens(_poolLens);
        maverickPosition = IMaverickV2Position(_maverickPosition);
        quoter = IMaverickV2Quoter(_maverickQuoter);
        mPool = IMaverickV2Pool(_mPool);
        votingDistributor = IVotingDistributor(_votingDistributor);
        poolDistributor = IPoolDistributor(_poolDistributor);

        // prevent implementation contract to be governed
        _setGovernor(address(0));
    }

    /**
     * @notice initialize function, to set up initial internal state
     */
    function initialize() external onlyGovernor initializer {
        // Read reward
        address[] memory _rewardTokens = new address[](1);
        _rewardTokens[0] = poolDistributor.rewardToken();

        require(_rewardTokens[0] != address(0), "No reward token configured");

        InitializableAbstractStrategy._initialize(
            _rewardTokens,
            new address[](0),
            new address[](0)
        );
    }

    /***************************************
                  Configuration 
    ****************************************/

    /**
     * @notice Set allowed pool weth share interval. After the rebalance happens
     * the share of WETH token in the ticker needs to be within the specifications
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
            _allowedWethShareStart,
            _allowedWethShareEnd
        );
    }

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
        _deposit(WETH, _wethBalance);
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
        // as to not break the mints - in case it would be configured as a default asset strategy
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
     * @param _asset   Address of the asset
     * @return bool    True when the _asset is WETH
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH;
    }

    /**
     * @dev Approve the spending amounts for the assets
     */
    function _approveTokenAmounts(
        uint256 _wethAllowance,
        uint256 _oethAllowance
    ) internal {
        IERC20(WETH).approve(address(liquidityManager), _wethAllowance);
        IERC20(OETH).approve(address(liquidityManager), _oethAllowance);
    }

    /***************************************
              Liquidity management
    ****************************************/
    /**
     * @dev Add liquidity into the pool in the pre-configured WETH to OETH share ratios
     * defined by the allowedPoolWethShareStart|End interval.
     *
     * Normally a PoolLens contract is used to prepare the parameters to add liquidity to the
     * Rooster pools. It has some errors when doing those calculation and for that reason a
     * much more accurate Quoter contract is used. This is possible due to our requirement of
     * adding liquidity only to one tick - PoolLens supports adding liquidity into multiple ticks
     * using different distribution ratios.
     */
    function _addLiquidity() internal {
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        uint256 _oethBalance = IERC20(OETH).balanceOf(address(this));
        // don't deposit small liquidity amounts
        if (_wethBalance <= ACTION_THRESHOLD) {
            return;
        }

        (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            uint256 WETHRequired,
            uint256 OETHRequired
        ) = _getAddLiquidityParams(_wethBalance, 1e30);

        if (OETHRequired > _oethBalance) {
            IVault(vaultAddress).mintForStrategy(OETHRequired - _oethBalance);
        }

        _approveTokenAmounts(WETHRequired, OETHRequired);

        (
            uint256 _wethAmount,
            uint256 _oethAmount,
            uint32[] memory binIds
        ) = liquidityManager.addPositionLiquidityToSenderByTokenIndex(
                mPool,
                0, // NFT token index
                packedSqrtPriceBreaks,
                packedArgs
            );

        require(binIds.length == 1, "Unexpected binIds length");

        // burn remaining OETH
        _burnOethOnTheContract();
        _updateUnderlyingAssets();

        // needs to be called after _updateUnderlyingAssets so the updated amount
        // is reflected in the event
        emit LiquidityAdded(
            _wethBalance, // wethAmountDesired
            OETHRequired, // oethAmountDesired
            _wethAmount, // wethAmountSupplied
            _oethAmount, // oethAmountSupplied
            tokenId, // tokenId
            underlyingAssets
        );
    }

    /**
     * @dev The function creates liquidity parameters required to be able to add liquidity to the pool.
     * The function needs to handle the 3 different cases of the way liquidity is added:
     *  - only WETH present in the tick
     *  - only OETH present in the tick
     *  - both tokens present in the tick
     *
     */
    function _getAddLiquidityParams(uint256 _maxWETH, uint256 _maxOETH)
        internal
        returns (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            uint256 WETHRequired,
            uint256 OETHRequired
        )
    {
        IMaverickV2Pool.AddLiquidityParams[]
            memory addParams = new IMaverickV2Pool.AddLiquidityParams[](1);
        int32[] memory ticks = new int32[](1);
        uint128[] memory amounts = new uint128[](1);
        ticks[0] = TICK_NUMBER;
        // arbitrary LP amount
        amounts[0] = 1e24;

        // construct value for Quoter with arbitrary LP amount
        IMaverickV2Pool.AddLiquidityParams memory addParam = IMaverickV2Pool
            .AddLiquidityParams({
                kind: MAV_STATIC_BIN_KIND,
                ticks: ticks,
                amounts: amounts
            });

        // get the WETH and OETH required to get the proportion of tokens required
        // given the arbitrary liquidity
        (WETHRequired, OETHRequired, ) = quoter.calculateAddLiquidity(
            mPool,
            addParam
        );

        /**
         * If either token required is 0 then the tick consists only of the other token. In that
         * case the liquidity calculations need to be done using the non 0 token. By setting the
         * tokenRequired from 0 to 1 the `min` in next step will ignore that (the bigger) value.
         */
        WETHRequired = WETHRequired == 0 ? 1 : WETHRequired;
        OETHRequired = OETHRequired == 0 ? 1 : OETHRequired;

        addParam.amounts[0] = Math_v5
            .min(
                ((_maxWETH - 1) * 1e24) / WETHRequired,
                ((_maxOETH - 1) * 1e24) / OETHRequired
            )
            .toUint128();

        // update the quotes with the actual amounts
        (WETHRequired, OETHRequired, ) = quoter.calculateAddLiquidity(
            mPool,
            addParam
        );

        require(_maxWETH >= WETHRequired, "More WETH required than specified");
        require(_maxOETH >= OETHRequired, "More OETH required than specified");

        // organize values to be used by manager
        addParams[0] = addParam;
        packedArgs = liquidityManager.packAddLiquidityArgsArray(addParams);
        // price can stay 0 if array only has one element
        packedSqrtPriceBreaks = liquidityManager.packUint88Array(
            new uint88[](1)
        );
    }

    /**
     * @dev Check that the Rooster pool price is within the expected
     *      parameters.
     *      This function works whether the strategy contract has liquidity
     *      position in the pool or not. The function returns _wethSharePct
     *      as a gas optimization measure.
     * @param _throwException  when set to true the function throws an exception
     *                         when pool's price is not within expected range.
     * @return _isExpectedRange  Bool expressing price is within expected range
     * @return _wethSharePct  Share of WETH owned by this strategy contract in the
     *                        configured ticker.
     */
    function _checkForExpectedPoolPrice(bool _throwException)
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
            if (_throwException) {
                revert OutsideExpectedTickRange();
            }
            
            return (false, _currentPrice <= sqrtPriceTickLower ? 0 : 1e18);
        }

        // 18 decimal number expressed WETH tick share
        _wethSharePct = _getWethShare(_currentPrice);

        if (
            _wethSharePct < allowedWethShareStart ||
            _wethSharePct > allowedWethShareEnd
        ) {
            if (_throwException) {
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
     * underlying rooster pool. Print the required amount of corresponding OETH. After the rebalancing is
     * done burn any potentially remaining OETH tokens still on the strategy contract.
     *
     * This function has a slightly different behaviour depending on the status of the underlying Rooster
     * pool. The function consists of the following 3 steps:
     * 1. withdrawLiquidityOption -> this is a configurable option where either only part of the liquidity
     *                               necessary for the swap is removed, or all of it. This way the rebalance
     *                               is able to optimize for volume, for efficiency or anything in between
     * 2. swapToDesiredPosition   -> move active trading price in the pool to be able to deposit WETH & OETH
     *                               tokens with the desired pre-configured ratios
     * 3. addLiquidity            -> add liquidity into the pool respecting ratio split configuration
     *
     *
     * Exact _amountToSwap, _swapWeth & _minTokenReceived parameters shall be determined by simulating the
     * transaction off-chain. The strategy checks that after the swap the share of the tokens is in the
     * expected ranges.
     *
     * @param _amountToSwap The amount of the token to swap
     * @param _swapWeth Swap using WETH when true, use OETH when false
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

    // slither-disable-start reentrancy-no-eth
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

        // in some cases (e.g. deposits) we will just want to add liquidity and not
        // issue a swap to move the active trading position within the pool. Before or after a
        // deposit or as a standalone call the strategist might issue a rebalance to move the
        // active trading price to a more desired position.
        if (_amountToSwap > 0) {
            // In case liquidity has been removed and there is still not enough WETH owned by the
            // strategy contract remove additional required amount of WETH.
            if (_swapWeth) _ensureWETHBalance(_amountToSwap);

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

    // slither-disable-end reentrancy-no-eth

    /**
     * @dev Perform a swap so that after the swap the tick has the desired WETH to OETH token share.
     */
    function _swapToDesiredPosition(
        uint256 _amountToSwap,
        bool _swapWeth,
        uint256 _minTokenReceived
    ) internal {
        IERC20 _tokenToSwap = IERC20(_swapWeth ? WETH : OETH);
        uint256 _balance = _tokenToSwap.balanceOf(address(this));

        if (_balance < _amountToSwap) {
            // This should never trigger since _ensureWETHBalance will already
            // throw an error if there is not enough WETH
            if (_swapWeth) {
                revert NotEnoughWethForSwap(_balance, _amountToSwap);
            }
            // if swapping OETH
            uint256 mintForSwap = _amountToSwap - _balance;
            IVault(vaultAddress).mintForStrategy(mintForSwap);
        }

        // SafeERC20 is used for IERC20 transfers. Not sure why slither complains
        // slither-disable-next-line unchecked-transfer
        _tokenToSwap.transfer(address(mPool), _amountToSwap);

        // tickLimit: the furthest tick a swap will execute in. If no limit is desired,
        // value should be set to type(int32).max for a tokenAIn (WETH) swap
        // and type(int32).min for a swap where tokenB (OETH) is the input

        IMaverickV2Pool.SwapParams memory swapParams = IMaverickV2Pool
        // exactOutput defines whether the amount specified is the output
        // or the input amount of the swap
            .SwapParams({
                amount: _amountToSwap,
                tokenAIn: _swapWeth,
                exactOutput: false,
                tickLimit: TICK_NUMBER
            });

        // swaps without a callback as the assets are already sent to the pool
        (, uint256 amountOut) = mPool.swap(
            address(this),
            swapParams,
            bytes("")
        );

        /**
         * There could be additional checks here for validating minTokenReceived is within the
         * expected range (e.g. 99% - 101% of the token sent in). Though that doesn't provide
         * any additional security. After the swap the `_checkForExpectedPoolPrice` validates
         * that the swap has moved the price into the expected tick (# -1).
         *
         * If the guardian forgets to set a `_minTokenReceived` and a sandwich attack bends
         * the pool before the swap the `_checkForExpectedPoolPrice` will fail the transaction.
         *
         * A check would not prevent a compromised guardian from stealing funds as multiple
         * transactions each loosing smaller amount of funds are still possible.
         */
        if (amountOut < _minTokenReceived) {
            revert SlippageCheck(amountOut);
        }

        /**
         * In the interest of each function in `_rebalance` to leave the contract state as
         * clean as possible the OETH tokens here are burned. This decreases the
         * dependence where `_swapToDesiredPosition` function relies on later functions
         * (`addLiquidity`) to burn the OETH. Reducing the risk of error introduction.
         */
        _burnOethOnTheContract();
    }

    /**
     * @dev This function removes the appropriate amount of liquidity to ensure that the required
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

        uint256 shareOfWethToRemove = _wethInThePool <= 1
            ? 1e18
            : Math_v5.min(
                /**
                 * When dealing with shares of liquidity to remove there is always some
                 * rounding involved. After extensive fuzz testing the below approach
                 * yielded the best results where the strategy overdraws the least and
                 * never removes insufficient amount of WETH.
                 */
                (_additionalWethRequired + 2).divPrecisely(_wethInThePool - 1) + 2,
                1e18
            );

        _removeLiquidity(shareOfWethToRemove);
    }

    /**
     * @dev Decrease partial or all liquidity from the pool.
     * @param _liquidityToDecrease The amount of liquidity to remove denominated in 1e18
     */
    function _removeLiquidity(uint256 _liquidityToDecrease) internal {
        require(_liquidityToDecrease > 0, "Must remove some liquidity");
        require(
            _liquidityToDecrease <= 1e18,
            "Can not remove more than 100% of liquidity"
        );

        // 0 indicates the first (and only) bin in the NFT LP position.
        IMaverickV2Pool.RemoveLiquidityParams memory params = maverickPosition
            .getRemoveParams(tokenId, 0, _liquidityToDecrease);
        (uint256 _amountWeth, uint256 _amountOeth) = maverickPosition
            .removeLiquidityToSender(tokenId, mPool, params);

        _burnOethOnTheContract();
        _updateUnderlyingAssets();

        // needs to be called after the _updateUnderlyingAssets so the updated amount is reflected
        // in the event
        emit LiquidityRemoved(
            _liquidityToDecrease,
            _amountWeth,
            _amountOeth,
            underlyingAssets
        );
    }

    /**
     * @dev Burns any OETH tokens remaining on the strategy contract if the balance is
     * above the action threshold.
     */
    function _burnOethOnTheContract() internal {
        uint256 _oethBalance = IERC20(OETH).balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(_oethBalance);
    }

    /**
     * @notice Returns the percentage of WETH liquidity in the configured ticker
     *         owned by this strategy contract.
     * @return uint256 1e18 denominated percentage expressing the share
     */
    function getWETHShare() external view returns (uint256) {
        uint256 _currentPrice = getPoolSqrtPrice();
        return _getWethShare(_currentPrice);
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
            uint256 oethAmount
        ) = _reservesInTickForGivenPriceAndLiquidity(
                sqrtPriceTickLower,
                sqrtPriceTickHigher,
                _currentPrice,
                1e24
            );

        return wethAmount.divPrecisely(wethAmount + oethAmount);
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
     *
     * @dev This amount is "gifted" to the strategy contract and will count as a yield
     *      surplus.
     */
    // slither-disable-start reentrancy-no-eth
    function mintInitialPosition() external onlyGovernor nonReentrant {
        require(tokenId == 0, "Initial position already minted");
        (
            bytes memory packedSqrtPriceBreaks,
            bytes[] memory packedArgs,
            uint256 WETHRequired,
            uint256 OETHRequired
        ) = _getAddLiquidityParams(1e16, 1e16);

        // Mint rounded up OETH amount
        if (OETHRequired > 0) {
            IVault(vaultAddress).mintForStrategy(OETHRequired);
        }

        _approveTokenAmounts(WETHRequired, OETHRequired);

        // Store the tokenId before calling updateUnderlyingAssets as it relies on the tokenId
        // not being 0
        (, , , tokenId) = liquidityManager.mintPositionNftToSender(
            mPool,
            packedSqrtPriceBreaks,
            packedArgs
        );

        // burn remaining OETH
        _burnOethOnTheContract();
        _updateUnderlyingAssets();
    }

    // slither-disable-end reentrancy-no-eth

    /**
     * @notice Returns the balance of tokens the strategy holds in the LP position
     * @return _amountWeth Amount of WETH in position
     * @return _amountOeth Amount of OETH in position
     */
    function getPositionPrincipal()
        public
        view
        returns (uint256 _amountWeth, uint256 _amountOeth)
    {
        if (tokenId == 0) {
            return (0, 0);
        }

        (_amountWeth, _amountOeth, ) = _getPositionInformation();
    }

    /**
     * @dev Returns the balance of tokens the strategy holds in the LP position
     * @return _amountWeth Amount of WETH in position
     * @return _amountOeth Amount of OETH in position
     * @return liquidity Amount of liquidity in the position
     */
    function _getPositionInformation()
        internal
        view
        returns (
            uint256 _amountWeth,
            uint256 _amountOeth,
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
        _amountOeth = positionInfo.amountB;
        liquidity = positionInfo.liquidities[0];
    }

    /**
     * Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99.8%) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view {
        uint256 _totalVaultValue = IVault(vaultAddress).totalValue();
        uint256 _totalOethSupply = IERC20(OETH).totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOethSupply) < SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /**
     * @dev Collect Rooster reward token, and send it to the harvesterAddress
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Do nothing if there's no position minted
        if (tokenId > 0) {
            uint32[] memory binIds = new uint32[](1);
            IMaverickV2Pool.TickState memory tickState = mPool.getTick(
                TICK_NUMBER
            );
            // get the binId for the MAV_STATIC_BIN_KIND in tick TICK_NUMBER (-1)
            binIds[0] = tickState.binIdsByTick[0];

            uint256 lastEpoch = votingDistributor.lastEpoch();

            poolDistributor.claimLp(
                address(this),
                tokenId,
                mPool,
                binIds,
                lastEpoch
            );
        }

        // Run the internal inherited function
        _collectRewardTokens();
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

        // because of PoolLens inaccuracy there is usually some dust WETH left on the contract
        uint256 _wethBalance = IERC20(WETH).balanceOf(address(this));
        // just paranoia check, in case there is OETH in the strategy that for some reason hasn't
        // been burned yet. This should always be 0.
        uint256 _oethBalance = IERC20(OETH).balanceOf(address(this));
        return underlyingAssets + _wethBalance + _oethBalance;
    }

    /// @dev This function updates the amount of underlying assets with the approach of the least possible
    ///      total tokens extracted for the current liquidity in the pool.
    function _updateUnderlyingAssets() internal {
        /**
         * Our net value represent the smallest amount of tokens we are able to extract from the position
         * given our liquidity.
         *
         * The least amount of tokens ex-tractable from the position is where the active trading price is
         * at the edge between tick -1 & tick 0. There the pool is offering 1:1 trades between WETH & OETH.
         * At that moment the pool consists completely of WETH and no OETH.
         *
         * The more swaps from OETH -> WETH happen on the pool the more the price starts to move away from the tick 0
         * towards the middle of tick -1 making OETH (priced in WETH) cheaper.
         */

        uint256 _wethAmount = tokenId == 0 ? 0 : _balanceInPosition();

        underlyingAssets = _wethAmount;
        emit UnderlyingAssetsUpdated(_wethAmount);
    }

    /**
     * @dev Strategy reserves (which consist only of WETH in case of Rooster - Plume pool)
     * when the tick price is closest to parity - assuring the lowest amount of tokens
     * returned for the current position liquidity.
     */
    function _balanceInPosition() internal view returns (uint256 _wethBalance) {
        (, , uint256 liquidity) = _getPositionInformation();

        uint256 _oethBalance;

        (_wethBalance, _oethBalance) = _reservesInTickForGivenPriceAndLiquidity(
            sqrtPriceTickLower,
            sqrtPriceTickHigher,
            sqrtPriceAtParity,
            liquidity
        );

        require(_oethBalance == 0, "Non zero oethBalance");
    }

    /**
     * @notice Tick dominance   denominated in 1e18
     * @return _tickDominance   The share of liquidity in TICK_NUMBER tick owned
     *                          by the strategy contract denominated in 1e18
     */
    function tickDominance() public view returns (uint256 _tickDominance) {
        IMaverickV2Pool.TickState memory tickState = mPool.getTick(TICK_NUMBER);

        uint256 wethReserve = tickState.reserveA;
        uint256 oethReserve = tickState.reserveB;

        // prettier-ignore
        (uint256 _amountWeth, uint256 _amountOeth, ) = _getPositionInformation();

        if (wethReserve + oethReserve == 0) {
            return 0;
        }

        _tickDominance = (_amountWeth + _amountOeth).divPrecisely(
            wethReserve + oethReserve
        );
    }

    /***************************************
            Hidden functions
    ****************************************/
    /**
     * @dev Unsupported
     */
    function setPTokenAddress(address, address) external pure override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /**
     * @dev Unsupported
     */
    function removePToken(uint256) external pure override {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /**
     * @dev Unsupported
     */
    function _abstractSetPToken(address, address) internal pure override {
        revert("Unsupported method");
    }

    /**
     * @dev Unsupported
     */
    function safeApproveAllTokens() external pure override {
        // all the amounts are approved at the time required
        revert("Unsupported method");
    }

    /***************************************
          Maverick liquidity utilities
    ****************************************/

    /// @notice Calculates deltaA = liquidity * (sqrt(upper) - sqrt(lower))
    ///  Calculates deltaB = liquidity / sqrt(lower) - liquidity / sqrt(upper),
    ///  i.e. liquidity * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
    ///
    /// @dev refactored from here:
    // solhint-disable-next-line max-line-length
    /// https://github.com/rooster-protocol/rooster-contracts/blob/main/v2-supplemental/contracts/libraries/LiquidityUtilities.sol#L665-L695
    function _reservesInTickForGivenPriceAndLiquidity(
        uint256 _lowerSqrtPrice,
        uint256 _upperSqrtPrice,
        uint256 _newSqrtPrice,
        uint256 _liquidity
    ) internal pure returns (uint128 reserveA, uint128 reserveB) {
        if (_liquidity == 0) {
            (reserveA, reserveB) = (0, 0);
        } else {
            uint256 lowerEdge = MathRooster.max(_lowerSqrtPrice, _newSqrtPrice);

            reserveA = MathRooster
                .mulCeil(
                    _liquidity,
                    MathRooster.clip(
                        MathRooster.min(_upperSqrtPrice, _newSqrtPrice),
                        _lowerSqrtPrice
                    )
                )
                .toUint128();
            reserveB = MathRooster
                .mulDivCeil(
                    _liquidity,
                    1e18 * MathRooster.clip(_upperSqrtPrice, lowerEdge),
                    _upperSqrtPrice * lowerEdge
                )
                .toUint128();
        }
    }
}
