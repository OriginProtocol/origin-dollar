// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { UniswapV3StrategyStorage } from "./UniswapV3StrategyStorage.sol";

import { INonfungiblePositionManager } from "../../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IStrategy } from "../../interfaces/IStrategy.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract UniswapV3LiquidityManager is UniswapV3StrategyStorage {
    using SafeERC20 for IERC20;

    function withdrawAssetFromActivePosition(address _asset, uint256 amount)
        external
        onlyVault
        nonReentrant
    {
        _withdrawAssetFromActivePosition(_asset, amount);
    }

    function _withdrawAssetFromActivePosition(address _asset, uint256 amount)
        internal
    {
        Position memory position = tokenIdToPosition[activeTokenId];
        require(position.exists && position.liquidity > 0, "Liquidity error");

        // Figure out liquidity to burn
        (
            uint128 liquidity,
            uint256 minAmount0,
            uint256 minAmount1
        ) = _calculateLiquidityToWithdraw(position, _asset, amount);

        // Liquidiate active position
        _decreasePositionLiquidity(
            position.tokenId,
            liquidity,
            minAmount0,
            minAmount1
        );
    }

    /**
     * @notice Calculates the amount liquidity that needs to be removed
     *          to Withdraw specified amount of the given asset.
     *
     * @param position  Position object
     * @param _asset    Token needed
     * @param amount    Minimum amount to liquidate
     *
     * @return liquidity    Liquidity to burn
     * @return minAmount0   Minimum amount0 to expect
     * @return minAmount1   Minimum amount1 to expect
     */
    function _calculateLiquidityToWithdraw(
        Position memory position,
        address _asset,
        uint256 amount
    )
        internal
        view
        returns (
            uint128 liquidity,
            uint256 minAmount0,
            uint256 minAmount1
        )
    {
        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();

        // Total amount in Liquidity pools
        (uint256 totalAmount0, uint256 totalAmount1) = helper
            .getAmountsForLiquidity(
                sqrtRatioX96,
                position.sqrtRatioAX96,
                position.sqrtRatioBX96,
                position.liquidity
            );

        if (_asset == token0) {
            minAmount0 = amount;
            minAmount1 = totalAmount1 / (totalAmount0 / amount);
            liquidity = helper.getLiquidityForAmounts(
                sqrtRatioX96,
                position.sqrtRatioAX96,
                position.sqrtRatioBX96,
                amount,
                minAmount1
            );
        } else if (_asset == token1) {
            minAmount0 = totalAmount0 / (totalAmount1 / amount);
            minAmount1 = amount;
            liquidity = helper.getLiquidityForAmounts(
                sqrtRatioX96,
                position.sqrtRatioAX96,
                position.sqrtRatioBX96,
                minAmount0,
                amount
            );
        }
    }

    /***************************************
            Rebalance
    ****************************************/

    modifier rebalanceNotPaused() {
        require(!rebalancePaused, "Rebalance paused");
        _;
    }

    /**
     * @notice Closes active LP position if any and then provides liquidity to the requested position.
     *         Mints new position, if it doesn't exist already.
     * @dev Will pull funds needed from reserve strategies and then will deposit back all dust to them
     * @param desiredAmount0 Amount of token0 to use to provide liquidity
     * @param desiredAmount1 Amount of token1 to use to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit/expect
     * @param minAmount1 Min amount of token1 to deposit/expect
     * @param minRedeemAmount0 Min amount of token0 received from closing active position
     * @param minRedeemAmount1 Min amount of token1 received from closing active position
     * @param lowerTick Desired lower tick index
     * @param upperTick Desired upper tick index
     */
    function rebalance(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1,
        uint256 minRedeemAmount0,
        uint256 minRedeemAmount1,
        int24 lowerTick,
        int24 upperTick
    )
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        rebalanceNotPaused
    {
        require(lowerTick < upperTick, "Invalid tick range");

        int48 tickKey = _getTickPositionKey(lowerTick, upperTick);
        uint256 tokenId = ticksToTokenId[tickKey];

        if (activeTokenId > 0) {
            // Close any active position
            _closePosition(activeTokenId, minRedeemAmount0, minRedeemAmount1);
        }

        // Withdraw enough funds from Reserve strategies
        _ensureAssetBalances(desiredAmount0, desiredAmount1);

        // Provide liquidity
        if (tokenId > 0) {
            // Add liquidity to the position token
            _increasePositionLiquidity(
                tokenId,
                desiredAmount0,
                desiredAmount1,
                minAmount0,
                minAmount1
            );
        } else {
            // Mint new position
            (tokenId, , , ) = _mintPosition(
                desiredAmount0,
                desiredAmount1,
                minAmount0,
                minAmount1,
                lowerTick,
                upperTick
            );
        }

        // Mark it as active position
        activeTokenId = tokenId;

        // Move any leftovers to Reserve
        _depositAll(
            token0,
            token1,
            vaultAddress,
            poolTokens[token0].minDepositThreshold,
            poolTokens[token1].minDepositThreshold
        );
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

    function swapAndRebalance(SwapAndRebalanceParams calldata params)
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        rebalanceNotPaused
    {
        require(params.lowerTick < params.upperTick, "Invalid tick range");

        uint256 tokenId = ticksToTokenId[
            _getTickPositionKey(params.lowerTick, params.upperTick)
        ];

        if (activeTokenId > 0) {
            // Close any active position
            _closePosition(
                activeTokenId,
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
            _increasePositionLiquidity(
                tokenId,
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
        activeTokenId = tokenId;

        // Move any leftovers to Reserve
        _depositAll(
            token0,
            token1,
            vaultAddress,
            poolTokens[token0].minDepositThreshold,
            poolTokens[token1].minDepositThreshold
        );
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
        tokenIdToPosition[tokenId] = Position({
            exists: true,
            tokenId: tokenId,
            liquidity: liquidity,
            lowerTick: lowerTick,
            upperTick: upperTick,
            sqrtRatioAX96: helper.getSqrtRatioAtTick(lowerTick),
            sqrtRatioBX96: helper.getSqrtRatioAtTick(upperTick)
        });

        emit UniswapV3PositionMinted(tokenId, lowerTick, upperTick);
        emit UniswapV3LiquidityAdded(tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Increases liquidity of the active position.
     * @dev Will pull funds needed from reserve strategies
     * @param tokenId Position NFT's tokenId
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     */
    function _increasePositionLiquidity(
        uint256 tokenId,
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1
    )
        internal
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        )
    {
        Position storage position = tokenIdToPosition[tokenId];
        require(position.exists, "No active position");

        // Withdraw enough funds from Reserve strategies
        _ensureAssetBalances(desiredAmount0, desiredAmount1);

        INonfungiblePositionManager.IncreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .IncreaseLiquidityParams({
                    tokenId: position.tokenId,
                    amount0Desired: desiredAmount0,
                    amount1Desired: desiredAmount1,
                    amount0Min: minAmount0,
                    amount1Min: minAmount1,
                    deadline: block.timestamp
                });

        (liquidity, amount0, amount1) = INonfungiblePositionManager(
            positionManager
        ).increaseLiquidity(params);

        position.liquidity += liquidity;

        emit UniswapV3LiquidityAdded(tokenId, amount0, amount1, liquidity);
    }

    function increaseActivePositionLiquidity(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 minAmount0,
        uint256 minAmount1
    )
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        _increasePositionLiquidity(
            activeTokenId,
            desiredAmount0,
            desiredAmount1,
            minAmount0,
            minAmount1
        );
    }

    /**
     * @notice Removes liquidity of the position in the pool
     *
     * @dev Scope intentionally set to public so that the base strategy can delegatecall this function.
     *      Setting it to external would restrict other functions in this contract from using it
     *
     * @param tokenId Position NFT's tokenId
     * @param liquidity Amount of liquidity to remove form the position
     * @param minAmount0 Min amount of token0 to withdraw
     * @param minAmount1 Min amount of token1 to withdraw
     *
     * @return amount0 Amount of token0 received after liquidation
     * @return amount1 Amount of token1 received after liquidation
     */
    function _decreasePositionLiquidity(
        uint256 tokenId,
        uint128 liquidity,
        uint256 minAmount0,
        uint256 minAmount1
    ) internal returns (uint256 amount0, uint256 amount1) {
        Position storage position = tokenIdToPosition[tokenId];
        require(position.exists, "Unknown position");

        (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
        (uint256 exactAmount0, uint256 exactAmount1) = helper
            .getAmountsForLiquidity(
                sqrtRatioX96,
                position.sqrtRatioAX96,
                position.sqrtRatioBX96,
                liquidity
            );

        INonfungiblePositionManager.DecreaseLiquidityParams
            memory params = INonfungiblePositionManager
                .DecreaseLiquidityParams({
                    tokenId: position.tokenId,
                    liquidity: liquidity,
                    amount0Min: minAmount0,
                    amount1Min: minAmount1,
                    deadline: block.timestamp
                });

        (amount0, amount1) = positionManager.decreaseLiquidity(params);

        position.liquidity -= liquidity;

        emit UniswapV3LiquidityRemoved(
            position.tokenId,
            amount0,
            amount1,
            liquidity
        );
    }

    function decreaseActivePositionLiquidity(
        uint128 liquidity,
        uint256 minAmount0,
        uint256 minAmount1
    )
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        _decreasePositionLiquidity(
            activeTokenId,
            liquidity,
            minAmount0,
            minAmount1
        );
    }

    /**
     * @notice Closes the position denoted by the tokenId and and collects all fees
     * @param tokenId Position NFT's tokenId
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
        Position memory position = tokenIdToPosition[tokenId];
        require(position.exists, "Invalid position");

        if (position.liquidity == 0) {
            return (0, 0);
        }

        // Remove all liquidity
        (amount0, amount1) = _decreasePositionLiquidity(
            tokenId,
            position.liquidity,
            minAmount0,
            minAmount1
        );

        if (position.tokenId == activeTokenId) {
            activeTokenId = 0;
        }

        emit UniswapV3PositionClosed(position.tokenId, amount0, amount1);

        // Collect all fees for position
        (uint256 amount0Fee, uint256 amount1Fee) = _collectFeesForToken(
            position.tokenId
        );

        amount0 = amount0 + amount0Fee;
        amount1 = amount1 + amount1Fee;
    }

    /**
     * @notice Closes the position denoted by the tokenId and and collects all fees
     * @param tokenId Token ID of the position to collect fees of.
     * @param minAmount0 Min amount of token0 to receive back
     * @param minAmount1 Min amount of token1 to receive back
     * @return amount0 Amount of token0 received after removing liquidity
     * @return amount1 Amount of token1 received after removing liquidity
     */
    function closePosition(
        uint256 tokenId,
        uint256 minAmount0,
        uint256 minAmount1
    )
        public
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        return _closePosition(tokenId, minAmount0, minAmount1);
    }

    /***************************************
            Balances and Fees
    ****************************************/
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
            vault.withdrawFromUniswapV3Reserve(
                token0,
                desiredAmount0 - token0Balance
            );
        }

        uint256 token1Balance = IERC20(token1).balanceOf(address(this));
        if (token1Balance < desiredAmount1) {
            vault.withdrawFromUniswapV3Reserve(
                token1,
                desiredAmount1 - token1Balance
            );
        }

        // TODO: Check value of assets moved here
    }

    function _checkSwapLimits(uint160 sqrtPriceLimitX96, bool swapZeroForOne)
        internal
        view
    {
        require(!swapsPaused, "Swaps are paused");

        (uint160 currentPriceX96, , , , , , ) = pool.slot0();

        require(
            minSwapPriceX96 <= currentPriceX96 &&
                currentPriceX96 <= maxSwapPriceX96,
            "Price out of bounds"
        );

        require(
            swapZeroForOne
                ? (sqrtPriceLimitX96 >= minSwapPriceX96)
                : (sqrtPriceLimitX96 <= maxSwapPriceX96),
            "Slippage out of bounds"
        );
    }

    function _ensureAssetsBySwapping(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 swapAmountIn,
        uint256 swapMinAmountOut,
        uint160 sqrtPriceLimitX96,
        bool swapZeroForOne
    ) internal {
        _checkSwapLimits(sqrtPriceLimitX96, swapZeroForOne);

        uint256 token0Balance = IERC20(token0).balanceOf(address(this));
        uint256 token1Balance = IERC20(token1).balanceOf(address(this));

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
                token1Needed > 0 && token1Needed > t1ReserveBal,
                "Cannot swap when the asset is available in reserve"
            );
            // Additional amount of token0 required for swapping
            token0Needed += swapAmountIn;
            // Subtract token1 that we will get from swapping
            token1Needed = (swapMinAmountOut >= token1Needed)
                ? 0
                : (token1Needed - swapMinAmountOut);
        } else {
            // Amount available in reserve strategies
            uint256 t0ReserveBal = IStrategy(poolTokens[token0].reserveStrategy)
                .checkBalance(token0);

            // Only swap when asset isn't available in reserve as well
            require(
                token0Needed > 0 && token0Needed > t0ReserveBal,
                "Cannot swap when the asset is available in reserve"
            );
            // Additional amount of token1 required for swapping
            token1Needed += swapAmountIn;
            // Subtract token0 that we will get from swapping
            // Subtract token1 that we will get from swapping
            token0Needed = (swapMinAmountOut >= token0Needed)
                ? 0
                : (token0Needed - swapMinAmountOut);
        }

        // Fund strategy from reserve strategies
        if (token0Needed > 0) {
            IVault(vaultAddress).withdrawFromUniswapV3Reserve(
                token0,
                token0Needed
            );
        }

        if (token1Needed > 0) {
            IVault(vaultAddress).withdrawFromUniswapV3Reserve(
                token1,
                token1Needed
            );
        }

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

    function collectFees()
        external
        onlyGovernorOrStrategistOrOperator
        returns (uint256 amount0, uint256 amount1)
    {
        return _collectFeesForToken(activeTokenId);
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
        require(tokenIdToPosition[tokenId].exists, "Invalid position");
        INonfungiblePositionManager.CollectParams
            memory params = INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (amount0, amount1) = positionManager.collect(params);

        emit UniswapV3FeeCollected(tokenId, amount0, amount1);
    }

    /***************************************
            Hidden functions
    ****************************************/
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        revert("NO_IMPL");
    }

    function safeApproveAllTokens() external virtual override {
        revert("NO_IMPL");
    }

    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
    {
        revert("NO_IMPL");
    }

    function depositAll() external virtual override {
        revert("NO_IMPL");
    }

    function withdraw(
        address recipient,
        address _asset,
        uint256 amount
    ) external override onlyVault onlyPoolTokens(_asset) nonReentrant {
        IERC20 asset = IERC20(_asset);
        uint256 selfBalance = asset.balanceOf(address(this));

        if (selfBalance < amount) {
            _withdrawAssetFromActivePosition(_asset, amount - selfBalance);
        }

        // Transfer requested amount
        asset.safeTransfer(recipient, amount);
        emit Withdrawal(_asset, _asset, amount);
    }

    /**
     * @notice Closes active LP position, if any, and transfer all token balance to Vault
     */
    function withdrawAll() external override onlyVault nonReentrant {
        if (activeTokenId > 0) {
            _closePosition(activeTokenId, 0, 0);
        }

        // saves 100B of contract size to loop through these 2 tokens
        address[2] memory tokens = [token0, token1];
        for(uint256 i = 0; i < 2; i++) {
            IERC20 tokenContract = IERC20(tokens[i]);    
            uint256 tokenBalance = tokenContract.balanceOf(address(this));

            if (tokenBalance > 0) {
                tokenContract.safeTransfer(vaultAddress, tokenBalance);
                emit Withdrawal(tokens[i], tokens[i], tokenBalance);
            }
        }
    }

    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        revert("NO_IMPL");
    }

    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        revert("NO_IMPL");
    }

    function setPTokenAddress(address, address) external override onlyGovernor {
        revert("NO_IMPL");
    }

    function removePToken(uint256) external override onlyGovernor {
        revert("NO_IMPL");
    }

    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        revert("NO_IMPL");
    }
}
