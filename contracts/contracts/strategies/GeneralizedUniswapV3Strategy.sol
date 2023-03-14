// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IVault } from "../interfaces/IVault.sol";

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { INonfungiblePositionManager } from "../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IUniswapV3Helper } from "../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import { UniswapV3StrategyLib } from "../utils/UniswapV3StrategyLib.sol";

contract GeneralizedUniswapV3Strategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    event OperatorChanged(address _address);
    event ReserveStrategyChanged(address asset, address reserveStrategy);
    event MinDepositThresholdChanged(
        address asset,
        uint256 minDepositThreshold
    );
    // event UniswapV3FeeCollected(
    //     uint256 indexed tokenId,
    //     uint256 amount0,
    //     uint256 amount1
    // );
    // event UniswapV3LiquidityAdded(
    //     uint256 indexed tokenId,
    //     uint256 amount0Sent,
    //     uint256 amount1Sent,
    //     uint128 liquidityMinted
    // );
    // event UniswapV3LiquidityRemoved(
    //     uint256 indexed tokenId,
    //     uint256 amount0Received,
    //     uint256 amount1Received,
    //     uint128 liquidityBurned
    // );
    event UniswapV3PositionMinted(
        uint256 indexed tokenId,
        int24 lowerTick,
        int24 upperTick
    );
    event UniswapV3PositionClosed(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received
    );
    event SwapsPauseStatusChanged(bool paused);
    event MaxSwapSlippageChanged(uint24 maxSlippage);
    event AssetSwappedForRebalancing(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // The address that can manage the positions on Uniswap V3
    address public operatorAddr;
    address public token0; // Token0 of Uniswap V3 Pool
    address public token1; // Token1 of Uniswap V3 Pool

    uint24 public poolFee; // Uniswap V3 Pool Fee
    uint24 public maxSwapSlippage = 100; // 1%; Reverts if swap slippage is higher than this
    bool public swapsPaused = false; // True if Swaps are paused

    uint256 public maxTVL; // In USD, 18 decimals

    // Represents both tokens supported by the strategy
    struct PoolToken {
        bool isSupported; // True if asset is either token0 or token1
        // When the funds are not deployed in Uniswap V3 Pool, they will
        // be deposited to these reserve strategies
        address reserveStrategy;
        // Deposits to reserve strategy when contract balance exceeds this amount
        uint256 minDepositThreshold;

        // uint256 minSwapPrice; // Min swap price for the token
    }

    struct SwapAndRebalanceParams {
        uint256 desiredAmount0;
        uint256 desiredAmount1;
        uint256 minAmount0;
        uint256 minAmount1;
        uint256 minRedeemAmount0;
        uint256 minRedeemAmount1;
        int24 lowerTick;
        int24 upperTick;
        uint256 swapAmountIn;
        uint256 swapMinAmountOut;
        uint160 sqrtPriceLimitX96;
        bool swapZeroForOne;
    }

    mapping(address => PoolToken) public poolTokens;

    // Uniswap V3's PositionManager
    INonfungiblePositionManager public positionManager;

    // // Represents a position minted by this contract
    // struct Position {
    //     bytes32 positionKey; // Required to read collectible fees from the V3 Pool
    //     uint256 tokenId; // ERC721 token Id of the minted position
    //     uint128 liquidity; // Amount of liquidity deployed
    //     int24 lowerTick; // Lower tick index
    //     int24 upperTick; // Upper tick index
    //     bool exists; // True, if position is minted
    //     // The following two fields are redundant but since we use these
    //     // two quite a lot, think it might be cheaper to store it than
    //     // compute it every time?
    //     uint160 sqrtRatioAX96;
    //     uint160 sqrtRatioBX96;
    // }

    // A lookup table to find token IDs of position using f(lowerTick, upperTick)
    mapping(int48 => uint256) internal ticksToTokenId;
    // Maps tokenIDs to their Position object
    mapping(uint256 => UniswapV3StrategyLib.Position) public tokenIdToPosition;
    // Token ID of the position that's being used to provide LP at the time
    uint256 public currentPositionTokenId;

    // A deployed contract that's used to call methods of Uniswap V3's libraries despite version mismatch
    IUniswapV3Helper internal uniswapV3Helper;

    ISwapRouter internal swapRouter;

    // Future-proofing
    uint256[100] private __gap;

    /***************************************
            Modifiers
    ****************************************/

    /**
     * @dev Ensures that the caller is Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    /**
     * @dev Ensures that the caller is Governor, Strategist or Operator.
     */
    modifier onlyGovernorOrStrategistOrOperator() {
        require(
            msg.sender == operatorAddr ||
                msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Operator, Strategist or Governor"
        );
        _;
    }

    /**
     * @dev Ensures that the asset address is either token0 or token1.
     */
    modifier onlyPoolTokens(address addr) {
        require(poolTokens[addr].isSupported, "Unsupported asset");
        _;
    }

    /***************************************
            Initializer
    ****************************************/

    /**
     * @dev Initialize the contract
     * @param _vaultAddress OUSD Vault
     * @param _poolAddress Uniswap V3 Pool
     * @param _nonfungiblePositionManager Uniswap V3's Position Manager
     * @param _token0ReserveStrategy Reserve Strategy for token0
     * @param _token1ReserveStrategy Reserve Strategy for token1
     * @param _operator Address that can manage LP positions on the V3 pool
     * @param _uniswapV3Helper Deployed UniswapV3Helper contract
     * @param _swapRouter Uniswap SwapRouter contract
     */
    function initialize(
        address _vaultAddress,
        address _poolAddress,
        address _nonfungiblePositionManager,
        address _token0ReserveStrategy,
        address _token1ReserveStrategy,
        address _operator,
        address _uniswapV3Helper,
        address _swapRouter
    ) external onlyGovernor initializer {
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        IUniswapV3Pool pool = IUniswapV3Pool(_poolAddress);
        uniswapV3Helper = IUniswapV3Helper(_uniswapV3Helper);
        swapRouter = ISwapRouter(_swapRouter);

        token0 = pool.token0();
        token1 = pool.token1();
        poolFee = pool.fee();

        address[] memory _assets = new address[](2);
        _assets[0] = token0;
        _assets[1] = token1;

        super._initialize(
            _poolAddress,
            _vaultAddress,
            new address[](0), // No Reward tokens
            _assets, // Asset addresses
            _assets // Platform token addresses
        );

        poolTokens[token0] = PoolToken({
            isSupported: true,
            reserveStrategy: address(0), // Set below using `_setReserveStrategy()`
            minDepositThreshold: 0
        });
        _setReserveStrategy(token0, _token0ReserveStrategy);

        poolTokens[token1] = PoolToken({
            isSupported: true,
            reserveStrategy: address(0), // Set below using `_setReserveStrategy()
            minDepositThreshold: 0
        });
        _setReserveStrategy(token1, _token1ReserveStrategy);

        _setOperator(_operator);
    }

    /***************************************
            Admin Utils
    ****************************************/

    /**
     * @notice Change the address of the operator
     * @dev Can only be called by the Governor or Strategist
     * @param _operator The new value to be set
     */
    function setOperator(address _operator) external onlyGovernorOrStrategist {
        _setOperator(_operator);
    }

    function _setOperator(address _operator) internal {
        operatorAddr = _operator;
        emit OperatorChanged(_operator);
    }

    /**
     * @notice Change the reserve strategies of the supported assets
     * @param _asset Asset to set the reserve strategy for
     * @param _reserveStrategy The new reserve strategy for token
     */
    function setReserveStrategy(address _asset, address _reserveStrategy)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        _setReserveStrategy(_asset, _reserveStrategy);
    }

    /**
     * @notice Change the reserve strategy of the supported asset
     * @dev Will throw if the strategies don't support the assets or if
     *      strategy is unsupported by the vault
     * @param _asset Asset to set the reserve strategy for
     * @param _reserveStrategy The new reserve strategy for token
     */
    function _setReserveStrategy(address _asset, address _reserveStrategy)
        internal
    {
        // require(
        //     IVault(vaultAddress).isStrategySupported(_reserveStrategy),
        //     "Unsupported strategy"
        // );

        // require(
        //     IStrategy(_reserveStrategy).supportsAsset(_asset),
        //     "Invalid strategy for asset"
        // );

        poolTokens[_asset].reserveStrategy = _reserveStrategy;

        emit ReserveStrategyChanged(_asset, _reserveStrategy);
    }

    /**
     * @notice Get reserve strategy of the given asset
     * @param _asset Address of the asset
     * @return reserveStrategyAddr Reserve strategy address
     */
    function reserveStrategy(address _asset)
        external
        view
        onlyPoolTokens(_asset)
        returns (address reserveStrategyAddr)
    {
        return poolTokens[_asset].reserveStrategy;
    }

    /**
     * @notice Change the minimum deposit threshold for the supported asset
     * @param _asset Asset to set the threshold
     * @param _minThreshold The new deposit threshold value
     */
    function setMinDepositThreshold(address _asset, uint256 _minThreshold)
        external
        onlyGovernorOrStrategist
        onlyPoolTokens(_asset)
    {
        PoolToken storage token = poolTokens[_asset];
        token.minDepositThreshold = _minThreshold;
        emit MinDepositThresholdChanged(_asset, _minThreshold);
    }

    function setSwapsPaused(bool _paused) external onlyGovernorOrStrategist {
        swapsPaused = _paused;
        emit SwapsPauseStatusChanged(_paused);
    }

    function setMaxSwapSlippage(uint24 _maxSlippage)
        external
        onlyGovernorOrStrategist
    {
        maxSwapSlippage = _maxSlippage;
        // emit SwapsPauseStatusChanged(_paused);
    }

    // function setMinSwapPrice(address _asset, uint256 _price) external onlyGovernorOrStrategist {
    //     maxSwapSlippage = _maxSlippage;
    //     // emit SwapsPauseStatusChanged(_paused);
    // }

    /***************************************
            Deposit/Withdraw
    ****************************************/

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        onlyPoolTokens(_asset)
        nonReentrant
    {
        if (_amount > poolTokens[_asset].minDepositThreshold) {
            IVault(vaultAddress).depositForUniswapV3(_asset, _amount);
            // Not emitting Deposit event since the Reserve strategy would do so
        }
    }

    /// @inheritdoc InitializableAbstractStrategy
    function depositAll() external override onlyVault nonReentrant {
        _depositAll();
    }

    /**
     * @notice Deposits all undeployed balances of the contract to the reserve strategies
     */
    function _depositAll() internal {
        uint256 token0Bal = IERC20(token0).balanceOf(address(this));
        uint256 token1Bal = IERC20(token1).balanceOf(address(this));
        if (
            token0Bal > 0 && token0Bal >= poolTokens[token0].minDepositThreshold
        ) {
            IVault(vaultAddress).depositForUniswapV3(token0, token0Bal);
        }
        if (
            token1Bal > 0 && token1Bal >= poolTokens[token1].minDepositThreshold
        ) {
            IVault(vaultAddress).depositForUniswapV3(token1, token1Bal);
        }
        // Not emitting Deposit events since the Reserve strategies would do so
    }

    function _withdrawAssetFromCurrentPosition(address _asset, uint256 amount)
        internal
    {
        UniswapV3StrategyLib.Position storage p = tokenIdToPosition[
            currentPositionTokenId
        ];
        require(p.exists && p.liquidity > 0, "Liquidity error");

        // Figure out liquidity to burn
        (
            uint128 liquidity,
            uint256 minAmount0,
            uint256 minAmount1
        ) = UniswapV3StrategyLib.calculateLiquidityToWithdraw(
                platformAddress,
                address(uniswapV3Helper),
                p,
                _asset,
                amount
            );

        // Liquidiate active position
        UniswapV3StrategyLib.decreaseLiquidityForPosition(
            platformAddress,
            address(positionManager),
            address(uniswapV3Helper),
            p,
            liquidity,
            minAmount0,
            minAmount1
        );
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdraw(
        address recipient,
        address _asset,
        uint256 amount
    ) external override onlyVault onlyPoolTokens(_asset) nonReentrant {
        IERC20 asset = IERC20(_asset);
        uint256 selfBalance = asset.balanceOf(address(this));

        if (selfBalance < amount) {
            _withdrawAssetFromCurrentPosition(_asset, amount - selfBalance);
        }

        // Transfer requested amount
        asset.safeTransfer(recipient, amount);
        emit Withdrawal(_asset, _asset, amount);
    }

    /**
     * @notice Closes active LP position, if any, and transfer all token balance to Vault
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdrawAll() external override onlyVault nonReentrant {
        if (currentPositionTokenId > 0) {
            // TODO: This method is only callable from Vault directly
            // and by Governor or Strategist indirectly.
            // Changing the Vault code to pass a minAmount0 and minAmount1 will
            // make things complex. We could perhaps make sure that there're no
            // active position when withdrawingAll rather than passing zero values?
            _closePosition(currentPositionTokenId, 0, 0);
        }

        IERC20 token0Contract = IERC20(token0);
        IERC20 token1Contract = IERC20(token1);

        uint256 token0Balance = token0Contract.balanceOf(address(this));
        if (token0Balance > 0) {
            token0Contract.safeTransfer(vaultAddress, token0Balance);
            emit Withdrawal(token0, token0, token0Balance);
        }

        uint256 token1Balance = token1Contract.balanceOf(address(this));
        if (token1Balance > 0) {
            token1Contract.safeTransfer(vaultAddress, token1Balance);
            emit Withdrawal(token1, token1, token1Balance);
        }
    }

    function _getToken1ForToken0(uint256 amount0) internal {}

    /**
     * @dev Checks if there's enough balance left in the contract to provide liquidity.
     *      If not, tries to pull it from reserve strategies
     * @param desiredAmount0 Minimum amount of token0 needed
     * @param desiredAmount1 Minimum amount of token1 needed
     */
    function _ensureAssetBalances(
        uint256 desiredAmount0,
        uint256 desiredAmount1
    ) internal {
        IVault vault = IVault(vaultAddress);

        // Withdraw enough funds from Reserve strategies
        uint256 token0Balance = IERC20(token0).balanceOf(address(this));
        if (token0Balance < desiredAmount0) {
            vault.withdrawAssetForUniswapV3(
                token0,
                desiredAmount0 - token0Balance
            );
        }

        uint256 token1Balance = IERC20(token1).balanceOf(address(this));
        if (token1Balance < desiredAmount1) {
            vault.withdrawAssetForUniswapV3(
                token1,
                desiredAmount1 - token1Balance
            );
        }

        // TODO: Check value of assets moved here
    }

    function _ensureAssetsBySwapping(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 swapAmountIn,
        uint256 swapMinAmountOut,
        uint160 sqrtPriceLimitX96,
        bool swapZeroForOne
    ) internal {
        require(!swapsPaused, "Swaps are paused");
        IERC20 t0Contract = IERC20(token0);
        IERC20 t1Contract = IERC20(token1);

        uint256 token0Balance = t0Contract.balanceOf(address(this));
        uint256 token1Balance = t1Contract.balanceOf(address(this));

        uint256 token0Needed = desiredAmount0 > token0Balance
            ? desiredAmount0 - token0Balance
            : 0;
        uint256 token1Needed = desiredAmount1 > token1Balance
            ? desiredAmount1 - token1Balance
            : 0;

        if (swapZeroForOne) {
            // Amount available in reserve strategies
            uint256 t1ReserveBal = IStrategy(poolTokens[token1].reserveStrategy)
                .checkBalance(token1);

            // Only swap when asset isn't available in reserve as well
            require(
                token1Needed > 0 && token1Needed < t1ReserveBal,
                "Cannot swap when the asset is available in reserve"
            );
            // Additional amount of token0 required for swapping
            token0Needed += swapAmountIn;
            // Subtract token1 that we will get from swapping
            token1Needed -= swapMinAmountOut;

            // Approve for swaps
            t0Contract.safeApprove(address(swapRouter), swapAmountIn);
        } else {
            // Amount available in reserve strategies
            uint256 t0ReserveBal = IStrategy(poolTokens[token0].reserveStrategy)
                .checkBalance(token0);

            // Only swap when asset isn't available in reserve as well
            require(
                token0Needed > 0 && token0Needed < t0ReserveBal,
                "Cannot swap when the asset is available in reserve"
            );
            // Additional amount of token1 required for swapping
            token1Needed += swapAmountIn;
            // Subtract token0 that we will get from swapping
            token0Needed -= swapMinAmountOut;

            // Approve for swaps
            t1Contract.safeApprove(address(swapRouter), swapAmountIn);
        }

        // TODO: Check value of token0Needed and token1Needed

        // Fund strategy from reserve strategies
        if (token0Needed > 0) {
            IVault(vaultAddress).withdrawAssetForUniswapV3(
                token0,
                token0Needed
            );
        }

        if (token1Needed > 0) {
            IVault(vaultAddress).withdrawAssetForUniswapV3(
                token0,
                token0Needed
            );
        }

        // TODO: Slippage/price check

        // Swap it
        uint256 amountReceived = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: swapZeroForOne ? token0 : token1,
                tokenOut: swapZeroForOne ? token1 : token0,
                fee: poolFee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: swapAmountIn,
                amountOutMinimum: swapMinAmountOut,
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        );

        emit AssetSwappedForRebalancing(
            swapZeroForOne ? token0 : token1,
            swapZeroForOne ? token1 : token0,
            swapAmountIn,
            amountReceived
        );

        // TODO: Check value of assets moved here
    }

    /***************************************
            Balances and Fees
    ****************************************/

    /**
     * @notice Collect accumulated fees from the active position
     * @dev Doesn't send to vault or harvester
     */
    function collectFees()
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        if (currentPositionTokenId > 0) {
            UniswapV3StrategyLib.collectFeesForToken(
                address(positionManager),
                currentPositionTokenId
            );
        }
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
        (amount0, amount1) = uniswapV3Helper.positionFees(
            positionManager,
            platformAddress,
            currentPositionTokenId
        );
    }

    /**
     * @dev Only checks the active LP position.
     *      Doesn't return the balance held in the reserve strategies.
     * @inheritdoc InitializableAbstractStrategy
     */
    function checkBalance(address _asset)
        external
        view
        override
        onlyPoolTokens(_asset)
        returns (uint256 balance)
    {
        balance = IERC20(_asset).balanceOf(address(this));

        (uint160 sqrtRatioX96, , , , , , ) = IUniswapV3Pool(platformAddress)
            .slot0();

        if (currentPositionTokenId > 0) {
            require(
                tokenIdToPosition[currentPositionTokenId].exists,
                "Invalid token"
            );

            (uint256 amount0, uint256 amount1) = uniswapV3Helper.positionValue(
                positionManager,
                platformAddress,
                currentPositionTokenId,
                sqrtRatioX96
            );

            if (_asset == token0) {
                balance += amount0;
            } else if (_asset == token1) {
                balance += amount1;
            }
        }
    }

    /***************************************
            Pool Liquidity Management
    ****************************************/

    /**
     * @notice Returns a unique ID based on lowerTick and upperTick
     * @dev Basically concats the lower tick and upper tick values. Shifts the value
     *      of lowerTick by 24 bits and then adds the upperTick value to avoid overlaps.
     *      So, the result is smaller in size (int48 rather than bytes32 when using keccak256)
     * @param lowerTick Lower tick index
     * @param upperTick Upper tick index
     * @return key A unique identifier to be used with ticksToTokenId
     */
    function _getTickPositionKey(int24 lowerTick, int24 upperTick)
        internal
        returns (int48 key)
    {
        if (lowerTick > upperTick)
            (lowerTick, upperTick) = (upperTick, lowerTick);
        key = int48(lowerTick) * 2**24; // Shift by 24 bits
        key = key + int24(upperTick);
    }

    /**
     * @notice Closes active LP position if any and then provides liquidity to the requested position.
     *         Mints new position, if it doesn't exist already.
     * @dev Will pull funds needed from reserve strategies and then will deposit back all dust to them
     * @param desiredAmounts Amounts of token0 and token1 to use to provide liquidity
     * @param minAmounts Min amounts of token0 and token1 to deposit/expect
     * @param minRedeemAmounts Min amount of token0 and token1 received from closing active position
     * @param lowerTick Desired lower tick index
     * @param upperTick Desired upper tick index
     */
    function _rebalance(
        uint256[2] calldata desiredAmounts,
        uint256[2] calldata minAmounts,
        uint256[2] calldata minRedeemAmounts,
        int24 lowerTick,
        int24 upperTick
    ) internal {
        require(lowerTick < upperTick, "Invalid tick range");

        int48 tickKey = _getTickPositionKey(lowerTick, upperTick);
        uint256 tokenId = ticksToTokenId[tickKey];

        if (currentPositionTokenId > 0) {
            // Close any active position
            _closePosition(
                currentPositionTokenId,
                minRedeemAmounts[0],
                minRedeemAmounts[1]
            );
        }

        // Withdraw enough funds from Reserve strategies
        _ensureAssetBalances(desiredAmounts[0], desiredAmounts[1]);

        // Provide liquidity
        if (tokenId > 0) {
            // Add liquidity to the position token
            UniswapV3StrategyLib.Position storage p = tokenIdToPosition[
                tokenId
            ];
            UniswapV3StrategyLib.increaseLiquidityForPosition(
                address(positionManager),
                p,
                desiredAmounts[0],
                desiredAmounts[1],
                minAmounts[0],
                minAmounts[1]
            );
        } else {
            // Mint new position
            (tokenId, , , ) = _mintPosition(
                desiredAmounts[0],
                desiredAmounts[1],
                minAmounts[0],
                minAmounts[1],
                lowerTick,
                upperTick
            );
        }

        // Mark it as active position
        currentPositionTokenId = tokenId;

        // Move any leftovers to Reserve
        _depositAll();
    }

    /**
     * @notice Closes active LP position if any and then provides liquidity to the requested position.
     *         Mints new position, if it doesn't exist already.
     * @dev Will pull funds needed from reserve strategies and then will deposit back all dust to them
     * @param desiredAmounts Amounts of token0 and token1 to use to provide liquidity
     * @param minAmounts Min amounts of token0 and token1 to deposit/expect
     * @param minRedeemAmounts Min amount of token0 and token1 received from closing active position
     * @param lowerTick Desired lower tick index
     * @param upperTick Desired upper tick index
     */
    function rebalance(
        uint256[2] calldata desiredAmounts,
        uint256[2] calldata minAmounts,
        uint256[2] calldata minRedeemAmounts,
        int24 lowerTick,
        int24 upperTick
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        _rebalance(
            desiredAmounts,
            minAmounts,
            minRedeemAmounts,
            lowerTick,
            upperTick
        );
    }

    function swapAndRebalance(SwapAndRebalanceParams calldata params)
        external
        // uint256[2] calldata desiredAmounts,
        // uint256[2] calldata minAmounts,
        // uint256[2] calldata minRedeemAmounts,
        // int24 lowerTick,
        // int24 upperTick,
        // uint256 swapAmountIn,
        // uint256 swapMinAmountOut,
        // uint160 sqrtPriceLimitX96,
        // bool swapZeroForOne
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(params.lowerTick < params.upperTick, "Invalid tick range");

        uint256 tokenId = ticksToTokenId[
            _getTickPositionKey(params.lowerTick, params.upperTick)
        ];

        if (currentPositionTokenId > 0) {
            // Close any active position
            _closePosition(
                currentPositionTokenId,
                params.minRedeemAmount0,
                params.minRedeemAmount1
            );
        }

        // Withdraw enough funds from Reserve strategies and swap to desired amounts
        _ensureAssetsBySwapping(
            params.desiredAmount0,
            params.desiredAmount1,
            params.swapAmountIn,
            params.swapMinAmountOut,
            params.sqrtPriceLimitX96,
            params.swapZeroForOne
        );

        // Provide liquidity
        if (tokenId > 0) {
            // Add liquidity to the position token
            UniswapV3StrategyLib.Position storage p = tokenIdToPosition[
                tokenId
            ];
            UniswapV3StrategyLib.increaseLiquidityForPosition(
                address(positionManager),
                p,
                params.desiredAmount0,
                params.desiredAmount1,
                params.minAmount0,
                params.minAmount1
            );
        } else {
            // Mint new position
            (tokenId, , , ) = _mintPosition(
                params.desiredAmount0,
                params.desiredAmount1,
                params.minAmount0,
                params.minAmount1,
                params.lowerTick,
                params.upperTick
            );
        }

        // Mark it as active position
        currentPositionTokenId = tokenId;

        // Move any leftovers to Reserve
        _depositAll();
    }

    // function swapAndRebalance(
    //     uint256[2] calldata desiredAmounts,
    //     uint256[2] calldata minAmounts,
    //     uint256[2] calldata minRedeemAmounts,
    //     int24 lowerTick,
    //     int24 upperTick,
    //     uint256 swapAmountIn,
    //     uint256 swapMinAmountOut,
    //     uint160 sqrtPriceLimitX96,
    //     bool swapZeroForOne
    // ) external onlyGovernorOrStrategistOrOperator nonReentrant {
    //     _swapAndRebalance(desiredAmounts, minAmounts, minRedeemAmounts, lowerTick, upperTick, swapAmountIn, swapMinAmountOut, sqrtPriceLimitX96, swapZeroForOne);
    // }

    /**
     * @notice Increases liquidity of the active position.
     * @dev Will pull funds needed from reserve strategies and then will deposit back all dust to them
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     */
    function increaseLiquidityForActivePosition(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        require(currentPositionTokenId > 0, "No active position");

        // Withdraw enough funds from Reserve strategies
        _ensureAssetBalances(desiredAmount0, desiredAmount1);

        UniswapV3StrategyLib.increaseLiquidityForPosition(
            address(positionManager),
            tokenIdToPosition[currentPositionTokenId],
            desiredAmount0,
            desiredAmount1,
            minAmount0,
            minAmount1
        );

        // Deposit all dust back to reserve strategies
        _depositAll();
    }

    /**
     * @notice Removes all liquidity from active position and collects the fees
     * @param minAmount0 Min amount of token0 to receive back
     * @param minAmount1 Min amount of token1 to receive back
     */
    function closeActivePosition(uint256 minAmount0, uint256 minAmount1)
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        _closePosition(currentPositionTokenId, minAmount0, minAmount1);

        // Deposit all dust back to reserve strategies
        _depositAll();
    }

    /**
     * @notice Removes all liquidity from specified position and collects the fees
     * @dev Must be a position minted by this contract
     * @param tokenId ERC721 token ID of the position to liquidate
     */
    function closePosition(
        uint256 tokenId,
        uint256 minAmount0,
        uint256 minAmount1
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        _closePosition(tokenId, minAmount0, minAmount1);

        // Deposit all dust back to reserve strategies
        _depositAll();
    }

    /**
     * @notice Closes the position denoted by the tokenId and and collects all fees
     * @param tokenId ERC721 token ID of the position to liquidate
     * @param minAmount0 Min amount of token0 to receive back
     * @param minAmount1 Min amount of token1 to receive back
     * @return amount0 Amount of token0 received after removing liquidity
     * @return amount1 Amount of token1 received after removing liquidity
     */
    function _closePosition(
        uint256 tokenId,
        uint256 minAmount0,
        uint256 minAmount1
    ) internal returns (uint256 amount0, uint256 amount1) {
        UniswapV3StrategyLib.Position storage p = tokenIdToPosition[tokenId];
        require(p.exists, "Invalid position");

        if (p.liquidity == 0) {
            return (0, 0);
        }

        // Remove all liquidity
        (amount0, amount1) = UniswapV3StrategyLib.decreaseLiquidityForPosition(
            platformAddress,
            address(positionManager),
            address(uniswapV3Helper),
            p,
            p.liquidity,
            minAmount0,
            minAmount1
        );

        if (tokenId == currentPositionTokenId) {
            currentPositionTokenId = 0;
        }

        emit UniswapV3PositionClosed(tokenId, amount0, amount1);

        // Collect all fees for position
        (uint256 amount0Fee, uint256 amount1Fee) = UniswapV3StrategyLib
            .collectFeesForToken(address(positionManager), p.tokenId);

        amount0 = amount0 + amount0Fee;
        amount1 = amount1 + amount1Fee;
    }

    /**
     * @notice Mints a new position on the pool and provides liquidity to it
     *
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     * @param lowerTick Lower tick index
     * @param upperTick Upper tick index
     *
     * @return tokenId ERC721 token ID of the position minted
     * @return liquidity Amount of liquidity added to the pool
     * @return amount0 Amount of token0 added to the position
     * @return amount1 Amount of token1 added to the position
     */
    function _mintPosition(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1,
        int24 lowerTick,
        int24 upperTick
    )
        internal
        returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        int48 tickKey = _getTickPositionKey(lowerTick, upperTick);
        require(ticksToTokenId[tickKey] == 0, "Duplicate position mint");

        INonfungiblePositionManager.MintParams
            memory params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: poolFee,
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: desiredAmount0,
                amount1Desired: desiredAmount1,
                amount0Min: minAmount0,
                amount1Min: minAmount1,
                recipient: address(this),
                deadline: block.timestamp
            });

        (tokenId, liquidity, amount0, amount1) = positionManager.mint(params);

        ticksToTokenId[tickKey] = tokenId;
        tokenIdToPosition[tokenId] = UniswapV3StrategyLib.Position({
            exists: true,
            tokenId: tokenId,
            liquidity: liquidity,
            lowerTick: lowerTick,
            upperTick: upperTick,
            sqrtRatioAX96: uniswapV3Helper.getSqrtRatioAtTick(lowerTick),
            sqrtRatioBX96: uniswapV3Helper.getSqrtRatioAtTick(upperTick),
            positionKey: keccak256(
                abi.encodePacked(address(positionManager), lowerTick, upperTick)
            )
        });

        emit UniswapV3PositionMinted(tokenId, lowerTick, upperTick);
        emit UniswapV3StrategyLib.UniswapV3LiquidityAdded(
            tokenId,
            amount0,
            amount1,
            liquidity
        );
    }

    /***************************************
            ERC721 management
    ****************************************/

    /// Callback function for whenever a NFT is transferred to this contract
    // solhint-disable-next-line max-line-length
    /// Ref: https://docs.openzeppelin.com/contracts/3.x/api/token/erc721#IERC721Receiver-onERC721Received-address-address-uint256-bytes-
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        // TODO: Should we reject unwanted NFTs being transfered to the strategy?
        // Could use `INonfungiblePositionManager.positions(tokenId)` to see if the token0 and token1 are matching
        return this.onERC721Received.selector;
    }

    /***************************************
            Inherited functions
    ****************************************/

    /// @inheritdoc InitializableAbstractStrategy
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        IERC20(token0).safeApprove(vaultAddress, type(uint256).max);
        IERC20(token1).safeApprove(vaultAddress, type(uint256).max);
        IERC20(token0).safeApprove(address(positionManager), type(uint256).max);
        IERC20(token1).safeApprove(address(positionManager), type(uint256).max);
    }

    /**
     * Removes all allowance of both the tokens from NonfungiblePositionManager
     */
    function resetAllowanceOfTokens() external onlyGovernor nonReentrant {
        IERC20(token0).safeApprove(address(positionManager), 0);
        IERC20(token1).safeApprove(address(positionManager), 0);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address _asset, address) internal override {
        IERC20(_asset).safeApprove(vaultAddress, type(uint256).max);
        IERC20(_asset).safeApprove(address(positionManager), type(uint256).max);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == token0 || _asset == token1;
    }

    /***************************************
            Hidden functions
    ****************************************/

    function setPTokenAddress(address, address) external override onlyGovernor {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    function removePToken(uint256) external override onlyGovernor {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    /// @inheritdoc InitializableAbstractStrategy
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Do nothing
    }
}
