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

contract GeneralizedUniswapV3Strategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    event OperatorChanged(address _address);
    event ReserveStrategiesChanged(
        address token0Strategy,
        address token1Strategy
    );
    event UniswapV3FeeCollected(
        uint256 indexed tokenId,
        uint256 amount0,
        uint256 amount1
    );
    event UniswapV3LiquidityAdded(
        uint256 indexed tokenId,
        uint256 amount0Sent,
        uint256 amount1Sent,
        uint128 liquidityMinted
    );
    event UniswapV3LiquidityRemoved(
        uint256 indexed tokenId,
        uint256 amount0Received,
        uint256 amount1Received,
        uint128 liquidityBurned
    );
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

    // The address that can manage the positions on Uniswap V3
    address public operatorAddr;
    address public token0; // Token0 of Uniswap V3 Pool
    address public token1; // Token1 of Uniswap V3 Pool

    uint24 public poolFee; // Uniswap V3 Pool Fee
    uint24 internal maxSlippage = 100; // 1%; Slippage tolerance when providing liquidity

    // Address mapping of (Asset -> Strategy). When the funds are
    // not deployed in Uniswap V3 Pool, they will be deposited
    // to these reserve strategies
    mapping(address => address) public reserveStrategy;

    // Uniswap V3's PositionManager
    INonfungiblePositionManager public nonfungiblePositionManager;

    // Represents a position minted by this contract
    struct Position {
        bytes32 positionKey; // Required to read collectible fees from the V3 Pool
        uint256 tokenId; // ERC721 token Id of the minted position
        uint128 liquidity; // Amount of liquidity deployed
        int24 lowerTick; // Lower tick index
        int24 upperTick; // Upper tick index
        bool exists; // True, if position is minted
        // The following two fields are redundant but since we use these
        // two quite a lot, think it might be cheaper to store it than
        // compute it every time?
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    // A lookup table to find token IDs of position using f(lowerTick, upperTick)
    mapping(int48 => uint256) internal ticksToTokenId;
    // Maps tokenIDs to their Position object
    mapping(uint256 => Position) internal tokenIdToPosition;
    // Token ID of the position that's being used to provide LP at the time
    uint256 internal currentPositionTokenId;

    // A deployed contract that's used to call methods of Uniswap V3's libraries despite version mismatch
    IUniswapV3Helper internal uniswapV3Helper;

    // Future-proofing
    uint256[50] private __gap;

    /**
     * @dev Ensures that the caller is Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr() ||
                msg.sender == governor(),
            "Caller is not the Operator, Strategist or Governor"
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
     * @dev Initialize the contract
     * @param _vaultAddress OUSD Vault
     * @param _poolAddress Uniswap V3 Pool
     * @param _nonfungiblePositionManager Uniswap V3's Position Manager
     * @param _token0ReserveStrategy Reserve Strategy for token0
     * @param _token1ReserveStrategy Reserve Strategy for token1
     * @param _operator Address that can manage LP positions on the V3 pool
     * @param _uniswapV3Helper Deployed UniswapV3Helper contract
     */
    function initialize(
        address _vaultAddress,
        address _poolAddress,
        address _nonfungiblePositionManager,
        address _token0ReserveStrategy,
        address _token1ReserveStrategy,
        address _operator,
        address _uniswapV3Helper
    ) external onlyGovernor initializer {
        nonfungiblePositionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );
        IUniswapV3Pool pool = IUniswapV3Pool(_poolAddress);
        uniswapV3Helper = IUniswapV3Helper(_uniswapV3Helper);

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

        _setReserveStrategy(_token0ReserveStrategy, _token1ReserveStrategy);
    }

    /***************************************
            Admin Utils
    ****************************************/

    /**
     * @notice Change the slippage tolerance
     * @dev Can only be called by Governor or Strategist
     * @param _slippage The new value to be set
     */
    function setMaxSlippage(uint24 _slippage)
        external
        onlyGovernorOrStrategist
    {
        require(_slippage <= 10000, "Invalid slippage value");
        // TODO: Should we make sure that Governor doesn't
        // accidentally set slippage > 2% or something???
        maxSlippage = _slippage;
    }

    /**
     * @notice Change the address of the operator
     * @dev Can only be called by the Governor
     * @param _operator The new value to be set
     */
    function setOperator(address _operator) external onlyGovernor {
        require(_operator != address(0), "Invalid operator address");
        operatorAddr = _operator;
        emit OperatorChanged(_operator);
    }

    /**
     * @notice Change the reserve strategies of the supported assets
     * @param _token0ReserveStrategy The new reserve strategy for token0
     * @param _token1ReserveStrategy The new reserve strategy for token1
     */
    function setReserveStrategy(
        address _token0ReserveStrategy,
        address _token1ReserveStrategy
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        _setReserveStrategy(_token0ReserveStrategy, _token1ReserveStrategy);
    }

    /**
     * @notice Change the reserve strategies of the supported assets
     * @dev Will throw if the strategies don't support the assets
     * @param _token0ReserveStrategy The new reserve strategy for token0
     * @param _token1ReserveStrategy The new reserve strategy for token1
     */
    function _setReserveStrategy(
        address _token0ReserveStrategy,
        address _token1ReserveStrategy
    ) internal {
        require(
            IStrategy(_token0ReserveStrategy).supportsAsset(token0),
            "Invalid Reserve Strategy"
        );
        require(
            IStrategy(_token1ReserveStrategy).supportsAsset(token1),
            "Invalid Reserve Strategy"
        );

        reserveStrategy[token0] = _token0ReserveStrategy;
        reserveStrategy[token1] = _token1ReserveStrategy;

        emit ReserveStrategiesChanged(
            _token0ReserveStrategy,
            _token1ReserveStrategy
        );
    }

    /***************************************
            Deposit/Withdraw
    ****************************************/

    /// @inheritdoc InitializableAbstractStrategy
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_asset == token0 || _asset == token1, "Unsupported asset");
        IVault(vaultAddress).depositForUniswapV3(_asset, _amount);
        // Not emitting Deposit event since the Reserve strategy would do so
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
        if (token0Bal > 0) {
            IVault(vaultAddress).depositForUniswapV3(token0, token0Bal);
        }
        if (token1Bal > 0) {
            IVault(vaultAddress).depositForUniswapV3(token1, token1Bal);
        }

        // Not emitting Deposit events since the Reserve strategies would do so
    }

    /**
     * @notice Withdraws asset from the reserve strategy
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdraw(
        address recipient,
        address _asset,
        uint256 amount
    ) external override onlyVault nonReentrant {
        require(_asset == token0 || _asset == token1, "Unsupported asset");

        IERC20 asset = IERC20(_asset);
        uint256 selfBalance = asset.balanceOf(address(this));

        if (selfBalance < amount) {
            // Try to pull remaining amount from reserve strategy
            // This might throw if there isn't enough in reserve strategy as well
            IVault(vaultAddress).withdrawForUniswapV3(
                recipient,
                _asset,
                amount - selfBalance
            );

            // TODO: Remove liquidity from V3 pool instead?

            // Transfer all of unused balance
            asset.safeTransfer(recipient, selfBalance);

            // Emit event for only the amount transferred out from this strategy
            emit Withdrawal(_asset, _asset, selfBalance);
        } else {
            // Transfer requested amount
            asset.safeTransfer(recipient, amount);
            emit Withdrawal(_asset, _asset, amount);
        }
    }

    /**
     * @notice Closes active LP position, if any, and transfer all token balance to Vault
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdrawAll() external override onlyVault nonReentrant {
        if (currentPositionTokenId > 0) {
            _closePosition(currentPositionTokenId);
        }

        IERC20 cToken0 = IERC20(token0);
        IERC20 cToken1 = IERC20(token1);

        uint256 token0Balance = cToken0.balanceOf(address(this));
        if (token0Balance >= 0) {
            cToken0.safeTransfer(vaultAddress, token0Balance);
            emit Withdrawal(token0, token0, token0Balance);
        }

        uint256 token1Balance = cToken1.balanceOf(address(this));
        if (token1Balance >= 0) {
            cToken1.safeTransfer(vaultAddress, token1Balance);
            emit Withdrawal(token1, token1, token1Balance);
        }
    }

    /**
     * @dev Checks if there's enough balance left in the contract to provide liquidity.
     *      If not, tries to pull it from reserve strategies
     * @param minAmount0 Minimum amount of token0 needed
     * @param minAmount1 Minimum amount of token1 needed
     */
    function _withdrawForLiquidity(uint256 minAmount0, uint256 minAmount1)
        internal
    {
        IERC20 cToken0 = IERC20(token0);
        IERC20 cToken1 = IERC20(token1);
        IVault vault = IVault(vaultAddress);

        // Withdraw enough funds from Reserve strategies
        uint256 token0Balance = cToken0.balanceOf(address(this));
        if (token0Balance < minAmount0) {
            vault.withdrawForUniswapV3(
                address(this),
                token0,
                minAmount0 - token0Balance
            );
        }

        uint256 token1Balance = cToken1.balanceOf(address(this));
        if (token1Balance < minAmount1) {
            vault.withdrawForUniswapV3(
                address(this),
                token1,
                minAmount1 - token1Balance
            );
        }
    }

    /***************************************
            Balances and Fees
    ****************************************/

    /**
     * @notice Collect accumulated fees from the active position
     * @dev Doesn't send to vault or harvester
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        if (currentPositionTokenId > 0) {
            _collectFeesForToken(currentPositionTokenId);
        }
    }

    /**
     * @notice Returns the accumulated fees from the active position
     * @return amount0 Amount of token0 ready to be collected as fee
     * @return amount1 Amount of token1 ready to be collected as fee
     */
    function getPendingRewards()
        external
        view
        returns (uint128 amount0, uint128 amount1)
    {
        Position memory p = tokenIdToPosition[currentPositionTokenId];

        (amount0, amount1) = _getTokensOwed(p);
    }

    /**
     * @notice Fetches the fees generated by the position on V3 pool
     * @param p Position struct
     * @return tokensOwed0 Amount of token0 ready to be collected as fee
     * @return tokensOwed1 Amount of token1 ready to be collected as fee
     */
    function _getTokensOwed(Position memory p)
        internal
        view
        returns (uint128 tokensOwed0, uint128 tokensOwed1)
    {
        if (!p.exists) return (0, 0);

        (, , , tokensOwed0, tokensOwed1) = IUniswapV3Pool(platformAddress)
            .positions(p.positionKey);
    }

    /**
     * @notice Collects the fees generated by the position on V3 pool
     * @param tokenId Token ID of the position to collect fees of.
     * @return amount0 Amount of token0 collected as fee
     * @return amount1 Amount of token1 collected as fee
     */
    function _collectFeesForToken(uint256 tokenId)
        internal
        returns (uint256 amount0, uint256 amount1)
    {
        INonfungiblePositionManager.CollectParams
            memory params = INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = nonfungiblePositionManager.collect(params);

        emit RewardTokenCollected(address(this), token0, amount0);
        emit RewardTokenCollected(address(this), token1, amount1);

        emit UniswapV3FeeCollected(tokenId, amount0, amount1);
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
        returns (uint256 balance)
    {
        require(_asset == token0 || _asset == token1, "Unsupported asset");

        balance = IERC20(_asset).balanceOf(address(this));

        (uint160 sqrtRatioX96, , , , , , ) = IUniswapV3Pool(platformAddress)
            .slot0();

        if (currentPositionTokenId > 0) {
            Position memory p = tokenIdToPosition[currentPositionTokenId];
            balance += _checkAssetBalanceOfPosition(_asset, p, sqrtRatioX96);
        }
    }

    /**
     * @dev Get the balance of an asset held in a LP position along with fees generated
     * @param asset Address of the asset
     * @param p Position object
     * @param sqrtRatioX96 Price ratio of the current tick of the pool
     * @return balance Total amount of the asset available
     */
    function _checkAssetBalanceOfPosition(
        address asset,
        Position memory p,
        uint160 sqrtRatioX96
    ) internal view returns (uint256 balance) {
        if (asset == token0) {
            (balance, ) = _checkBalanceOfPosition(p, sqrtRatioX96);
        } else {
            (, balance) = _checkBalanceOfPosition(p, sqrtRatioX96);
        }
    }

    /**
     * @notice Get the balance of both assets held in a LP position along with fees generated
     * @param p Position object
     * @param sqrtRatioX96 Price ratio of the current tick of the pool
     * @return amount0 Total amount of the token0 available
     * @return amount1 Total amount of the token1 available
     */
    function _checkBalanceOfPosition(Position memory p, uint160 sqrtRatioX96)
        internal
        view
        returns (uint256 amount0, uint256 amount1)
    {
        if (p.liquidity == 0) {
            // NOTE: Making the assumption that tokens owed for inactive positions
            // will always be zero (should be case since fees are collecting after
            // liquidity is removed)
            return (0, 0);
        }

        (amount0, amount1) = uniswapV3Helper.getAmountsForLiquidity(
            sqrtRatioX96,
            p.sqrtRatioAX96,
            p.sqrtRatioBX96,
            p.liquidity
        );

        (uint128 feeAmount0, uint128 feeAmount1) = _getTokensOwed(p);

        amount0 += feeAmount0;
        amount1 += feeAmount1;
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
     * @param key A unique identifier to be used with ticksToTokenId
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
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param lowerTick Lower tick index
     * @param upperTick Upper tick index
     */
    function rebalance(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        int24 lowerTick,
        int24 upperTick
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        int48 tickKey = _getTickPositionKey(lowerTick, upperTick);
        uint256 tokenId = ticksToTokenId[tickKey];

        if (currentPositionTokenId > 0) {
            // Close any active position
            _closePosition(currentPositionTokenId);
        }

        // Withdraw enough funds from Reserve strategies
        _withdrawForLiquidity(desiredAmount0, desiredAmount1);

        // Provide liquidity
        if (tokenId > 0) {
            // Add liquidity to the position token
            Position storage p = tokenIdToPosition[tokenId];
            _increaseLiquidityForPosition(p, desiredAmount0, desiredAmount1);
        } else {
            // Mint new position
            (tokenId, , , ) = _mintPosition(
                desiredAmount0,
                desiredAmount1,
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
     * @notice Increases liquidity of the active position.
     * @dev Will pull funds needed from reserve strategies and then will deposit back all dust to them
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     */
    function increaseLiquidityForActivePosition(
        uint256 desiredAmount0,
        uint256 desiredAmount1
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        require(currentPositionTokenId > 0, "No active position");

        // Withdraw enough funds from Reserve strategies
        _withdrawForLiquidity(desiredAmount0, desiredAmount1);

        Position storage p = tokenIdToPosition[currentPositionTokenId];
        _increaseLiquidityForPosition(p, desiredAmount0, desiredAmount1);

        // Deposit all dust back to reserve strategies
        _depositAll();
    }

    /**
     * @notice Removes all liquidity from active position and collects the fees
     */
    function closeActivePosition()
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(currentPositionTokenId > 0, "No active position");
        _closePosition(currentPositionTokenId);
    }

    /**
     * @notice Removes all liquidity from specified position and collects the fees
     * @dev Must be a position minted by this contract
     * @param tokenId ERC721 token ID of the position to liquidate
     */
    function closePosition(uint256 tokenId)
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(tokenIdToPosition[tokenId].exists, "Invalid position");
        _closePosition(tokenId);
    }

    /**
     * @notice Closes the position denoted by the tokenId and and collects all fees
     * @param tokenId ERC721 token ID of the position to liquidate
     * @param amount0 Amount of token0 received after removing liquidity
     * @param amount1 Amount of token1 received after removing liquidity
     */
    function _closePosition(uint256 tokenId)
        internal
        returns (uint256 amount0, uint256 amount1)
    {
        Position storage p = tokenIdToPosition[tokenId];

        if (p.liquidity == 0) {
            return (0, 0);
        }

        // Remove all liquidity
        (amount0, amount1) = _decreaseLiquidityForPosition(p, p.liquidity);

        // Collect all fees for position
        (uint256 amount0Fee, uint256 amount1Fee) = _collectFeesForToken(
            tokenId
        );

        amount0 = amount0 + amount0Fee;
        amount1 = amount1 + amount1Fee;

        if (tokenId == currentPositionTokenId) {
            currentPositionTokenId = 0;
        }

        emit UniswapV3PositionClosed(tokenId, amount0, amount1);
    }

    /**
     * @notice Mints a new position on the pool and provides liquidity to it
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param lowerTick Lower tick index
     * @param upperTick Upper tick index
     * @return tokenId ERC721 token ID of the position minted
     * @return liquidity Amount of liquidity added to the pool
     * @return amount0 Amount of token0 added to the position
     * @return amount1 Amount of token1 added to the position
     */
    function _mintPosition(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
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
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager
            .MintParams({
                token0: token0,
                token1: token1,
                fee: poolFee,
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: desiredAmount0,
                amount1Desired: desiredAmount1,
                amount0Min: maxSlippage == 0
                    ? 0
                    : (desiredAmount0 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                amount1Min: maxSlippage == 0
                    ? 0
                    : (desiredAmount1 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                recipient: address(this),
                deadline: block.timestamp
            });

        (tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager
            .mint(params);

        ticksToTokenId[_getTickPositionKey(lowerTick, upperTick)] = tokenId;
        tokenIdToPosition[tokenId] = Position({
            exists: true,
            tokenId: tokenId,
            liquidity: liquidity,
            lowerTick: lowerTick,
            upperTick: upperTick,
            sqrtRatioAX96: uniswapV3Helper.getSqrtRatioAtTick(lowerTick),
            sqrtRatioBX96: uniswapV3Helper.getSqrtRatioAtTick(upperTick),
            positionKey: keccak256(
                abi.encodePacked(
                    address(nonfungiblePositionManager),
                    lowerTick,
                    upperTick
                )
            )
        });

        emit UniswapV3PositionMinted(tokenId, lowerTick, upperTick);
        emit UniswapV3LiquidityAdded(tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Increases liquidity of the position in the pool
     * @param p Position object
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @return liquidity Amount of liquidity added to the pool
     * @return amount0 Amount of token0 added to the position
     * @return amount1 Amount of token1 added to the position
     */
    function _increaseLiquidityForPosition(
        Position storage p,
        uint256 desiredAmount0,
        uint256 desiredAmount1
    )
        internal
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        require(p.exists, "Unknown position");

        INonfungiblePositionManager.IncreaseLiquidityParams memory params = INonfungiblePositionManager
            .IncreaseLiquidityParams({
                tokenId: p.tokenId,
                amount0Desired: desiredAmount0,
                amount1Desired: desiredAmount1,
                amount0Min: maxSlippage == 0
                    ? 0
                    : (desiredAmount0 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                amount1Min: maxSlippage == 0
                    ? 0
                    : (desiredAmount1 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                deadline: block.timestamp
            });

        (liquidity, amount0, amount1) = nonfungiblePositionManager
            .increaseLiquidity(params);

        p.liquidity += liquidity;

        emit UniswapV3LiquidityAdded(p.tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Removes liquidity of the position in the pool
     * @param p Position object
     * @param liquidity Amount of liquidity to remove form the position
     * @return amount0 Amount of token0 received after liquidation
     * @return amount1 Amount of token1 received after liquidation
     */
    function _decreaseLiquidityForPosition(
        Position storage p,
        uint128 liquidity
    ) internal returns (uint256 amount0, uint256 amount1) {
        require(p.exists, "Unknown position");

        (uint160 sqrtRatioX96, , , , , , ) = IUniswapV3Pool(platformAddress)
            .slot0();
        (uint256 exactAmount0, uint256 exactAmount1) = uniswapV3Helper
            .getAmountsForLiquidity(
                sqrtRatioX96,
                p.sqrtRatioAX96,
                p.sqrtRatioBX96,
                liquidity
            );

        INonfungiblePositionManager.DecreaseLiquidityParams memory params = INonfungiblePositionManager
            .DecreaseLiquidityParams({
                tokenId: p.tokenId,
                liquidity: liquidity,
                amount0Min: maxSlippage == 0
                    ? 0
                    : (exactAmount0 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                amount1Min: maxSlippage == 0
                    ? 0
                    : (exactAmount1 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                deadline: block.timestamp
            });

        (amount0, amount1) = nonfungiblePositionManager.decreaseLiquidity(
            params
        );

        p.liquidity -= liquidity;

        emit UniswapV3LiquidityRemoved(p.tokenId, amount0, amount1, liquidity);
    }

    /***************************************
            ERC721 management
    ****************************************/

    /// Callback function for whenever a NFT is transferred to this contract
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
        IERC20(token0).safeApprove(
            address(nonfungiblePositionManager),
            type(uint256).max
        );
        IERC20(token1).safeApprove(
            address(nonfungiblePositionManager),
            type(uint256).max
        );
    }

    /**
     * Removes all allowance of both the tokens from NonfungiblePositionManager
     */
    function resetAllowanceOfTokens() external onlyGovernor nonReentrant {
        IERC20(token0).safeApprove(address(nonfungiblePositionManager), 0);
        IERC20(token1).safeApprove(address(nonfungiblePositionManager), 0);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        IERC20(_asset).safeApprove(
            address(nonfungiblePositionManager),
            type(uint256).max
        );
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

    function setPTokenAddress(address _asset, address _pToken)
        external
        override
        onlyGovernor
    {
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    function removePToken(uint256 _assetIndex) external override onlyGovernor {
        // The pool tokens can never change.
        revert("Unsupported method");
    }
}
