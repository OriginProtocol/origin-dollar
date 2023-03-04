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

    // Address of operator
    address public operatorAddr;
    address public token0;
    address public token1;

    uint24 public poolFee;
    uint24 internal maxSlippage = 100; // 1%

    mapping(address => address) public reserveStrategy;

    INonfungiblePositionManager public nonfungiblePositionManager;

    struct Position {
        bytes32 positionKey;
        uint256 tokenId;
        uint128 liquidity;
        int24 lowerTick;
        int24 upperTick;
        bool exists;
        // The following two fields are redundant but since we use these
        // two quite a lot, think it might be cheaper to store it than
        // compute it every time?
        uint160 sqrtRatioAX96;
        uint160 sqrtRatioBX96;
    }

    mapping(int48 => uint256) internal ticksToTokenId;
    mapping(uint256 => Position) internal tokenIdToPosition;
    uint256[] internal allTokenIds;
    uint256 internal currentPositionTokenId;

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

    function setMaxSlippage(uint24 _slippage)
        external
        onlyGovernorOrStrategist
    {
        require(_slippage <= 10000, "Invalid slippage value");
        // TODO: Should we make sure that Governor doesn't
        // accidentally set slippage > 2% or something???
        maxSlippage = _slippage;
    }

    function setOperator(address _operator) external onlyGovernor {
        require(_operator != address(0), "Invalid operator address");
        operatorAddr = _operator;
        emit OperatorChanged(_operator);
    }

    function setReserveStrategy(
        address _token0ReserveStrategy,
        address _token1ReserveStrategy
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        _setReserveStrategy(_token0ReserveStrategy, _token1ReserveStrategy);
    }

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

    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        IVault(vaultAddress).depositForUniswapV3(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        _depositAll();
    }

    function _depositAll() internal {
        uint256 token0Bal = IERC20(token0).balanceOf(address(this));
        uint256 token1Bal = IERC20(token1).balanceOf(address(this));
        if (token0Bal > 0) {
            IVault(vaultAddress).depositForUniswapV3(token0, token0Bal);
        }
        if (token1Bal > 0) {
            IVault(vaultAddress).depositForUniswapV3(token1, token1Bal);
        }
    }

    function withdraw(
        address recipient,
        address asset,
        uint256 amount
    ) external override onlyVault nonReentrant {
        uint256 reserveBalance = IStrategy(reserveStrategy[asset]).checkBalance(
            asset
        );

        // TODO: Remove liquidity from pool instead?
        require(reserveBalance >= amount, "Liquidity error");

        IVault(vaultAddress).withdrawForUniswapV3(recipient, asset, amount);
    }

    function withdrawAll() external override onlyVault nonReentrant {
        if (currentPositionTokenId > 0) {
            _closePosition(currentPositionTokenId);
        }

        IERC20 cToken0 = IERC20(token0);
        IERC20 cToken1 = IERC20(token1);

        uint256 token0Balance = cToken0.balanceOf(address(this));
        if (token0Balance >= 0) {
            cToken0.safeTransfer(vaultAddress, token0Balance);
        }

        uint256 token1Balance = cToken1.balanceOf(address(this));
        if (token1Balance >= 0) {
            cToken1.safeTransfer(vaultAddress, token1Balance);
        }
    }

    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            uint256 tokenId = allTokenIds[0];
            if (tokenIdToPosition[tokenId].liquidity > 0) {
                _collectFeesForToken(tokenId);
            }
        }
    }

    function getPendingRewards()
        external
        view
        returns (uint128 amount0, uint128 amount1)
    {
        Position memory p = tokenIdToPosition[currentPositionTokenId];

        (amount0, amount1) = _getTokensOwed(p);
    }

    function _getTokensOwed(Position memory p)
        internal
        view
        returns (uint128 tokensOwed0, uint128 tokensOwed1)
    {
        if (!p.exists) return (0, 0);

        (, , , tokensOwed0, tokensOwed1) = IUniswapV3Pool(platformAddress)
            .positions(p.positionKey);
    }

    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == token0 || _asset == token1, "Unsupported asset");
        // TODO: Should reserve strategy balance be included? Might result in double calculations
        balance = IERC20(_asset).balanceOf(address(this));

        (uint160 sqrtRatioX96, , , , , , ) = IUniswapV3Pool(platformAddress)
            .slot0();

        if (currentPositionTokenId > 0) {
            Position memory p = tokenIdToPosition[currentPositionTokenId];
            balance += _checkAssetBalanceOfPosition(_asset, p, sqrtRatioX96);
        }

        // for (uint256 i = 0; i < allTokenIds.length; i++) {
        //     // TODO: Should only current active position be checked?
        //     Position memory p = tokenIdToPosition[allTokenIds[i]];
        //     balance += _checkAssetBalanceOfPosition(_asset, p, sqrtRatioX96);
        // }
    }

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

    function rebalance(
        uint256 maxAmount0,
        uint256 maxAmount1,
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
        _withdrawForLiquidity(maxAmount0, maxAmount1);

        // Provide liquidity
        if (tokenId > 0) {
            // Add liquidity to the position token
            Position storage p = tokenIdToPosition[tokenId];
            _increaseLiquidityForPosition(p, maxAmount0, maxAmount1);
        } else {
            // Mint new position
            (tokenId, , , ) = _mintPosition(
                maxAmount0,
                maxAmount1,
                lowerTick,
                upperTick
            );
        }

        // Mark it as active position
        currentPositionTokenId = tokenId;

        // Move any leftovers to Reserve
        _depositAll();
    }

    function increaseLiquidityForActivePosition(
        uint256 maxAmount0,
        uint256 maxAmount1
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        require(currentPositionTokenId > 0, "No active position");

        // Withdraw enough funds from Reserve strategies
        _withdrawForLiquidity(maxAmount0, maxAmount1);

        Position storage p = tokenIdToPosition[currentPositionTokenId];
        _increaseLiquidityForPosition(p, maxAmount0, maxAmount1);

        // Deposit all dust back to reserve strategies
        _depositAll();
    }

    function closeActivePosition()
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(currentPositionTokenId > 0, "No active position");
        _closePosition(currentPositionTokenId);
    }

    function closePosition(uint256 tokenId)
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(tokenIdToPosition[tokenId].exists, "Invalid position");
        _closePosition(tokenId);
    }

    function _getTickPositionKey(int24 lowerTick, int24 upperTick)
        internal
        returns (int48 key)
    {
        if (lowerTick > upperTick)
            (lowerTick, upperTick) = (upperTick, lowerTick);
        key = int48(lowerTick) * 2**24; // Shift by 24 bits
        key = key + int24(upperTick);
    }

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

        emit UniswapV3FeeCollected(tokenId, amount0, amount1);
    }

    function _mintPosition(
        uint256 maxAmount0,
        uint256 maxAmount1,
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
                amount0Desired: maxAmount0,
                amount1Desired: maxAmount1,
                amount0Min: maxSlippage == 0
                    ? 0
                    : (maxAmount0 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                amount1Min: maxSlippage == 0
                    ? 0
                    : (maxAmount1 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                recipient: address(this),
                deadline: block.timestamp
            });

        (tokenId, liquidity, amount0, amount1) = nonfungiblePositionManager
            .mint(params);

        allTokenIds.push(tokenId);
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

    function _increaseLiquidityForPosition(
        Position storage p,
        uint256 maxAmount0,
        uint256 maxAmount1
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
                amount0Desired: maxAmount0,
                amount1Desired: maxAmount1,
                amount0Min: maxSlippage == 0
                    ? 0
                    : (maxAmount0 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                amount1Min: maxSlippage == 0
                    ? 0
                    : (maxAmount1 * (10000 - maxSlippage)) / 10000, // Price Slippage,
                deadline: block.timestamp
            });

        (liquidity, amount0, amount1) = nonfungiblePositionManager
            .increaseLiquidity(params);

        p.liquidity += liquidity;

        emit UniswapV3LiquidityAdded(p.tokenId, amount0, amount1, liquidity);
    }

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

    function resetAllowanceOfTokens() external onlyGovernor nonReentrant {
        IERC20(token0).safeApprove(address(nonfungiblePositionManager), 0);
        IERC20(token1).safeApprove(address(nonfungiblePositionManager), 0);
    }

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        IERC20(_asset).safeApprove(
            address(nonfungiblePositionManager),
            type(uint256).max
        );
    }

    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == token0 || _asset == token1;
    }

    /**
     * Unused/unnecessary inherited functions
     */

    function setPTokenAddress(address _asset, address _pToken)
        external
        override
        onlyGovernor
    {
        /**
         * This function isn't overridable from `InitializableAbstractStrategy` due to
         * missing `virtual` keyword. However, adding a function with same signature will
         * hide the inherited function
         */
        // The pool tokens can never change.
        revert("Unsupported method");
    }

    function removePToken(uint256 _assetIndex) external override onlyGovernor {
        /**
         * This function isn't overridable from `InitializableAbstractStrategy` due to
         * missing `virtual` keyword. However, adding a function with same signature will
         * hide the inherited function
         */
        // The pool tokens can never change.
        revert("Unsupported method");
    }
}
