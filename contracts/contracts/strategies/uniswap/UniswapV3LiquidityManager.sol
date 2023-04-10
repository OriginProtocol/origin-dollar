// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { UniswapV3StrategyStorage } from "./UniswapV3StrategyStorage.sol";

import { INonfungiblePositionManager } from "../../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Helpers } from "../../utils/Helpers.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract UniswapV3LiquidityManager is UniswapV3StrategyStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /***************************************
            Position Value
    ****************************************/
    /**
     * @notice Calculates the net value of the position exlcuding fees
     * @param tokenId tokenID of the Position NFT
     * @return posValue Value of position (in 18 decimals)
     */
    function getPositionValue(uint256 tokenId)
        internal
        view
        returns (uint256 posValue)
    {
        (uint256 amount0, uint256 amount1) = getPositionPrincipal(tokenId);

        posValue = _getValueOfTokens(amount0, amount1);
    }

    /**
     * @notice Calculates the net value of the token amounts (assumes it's pegged to $1)
     * @param amount0 Amount of token0
     * @param amount1 Amount of token1
     * @return value Net value (in 18 decimals)
     */
    function _getValueOfTokens(uint256 amount0, uint256 amount1)
        internal
        view
        returns (uint256 value)
    {
        value += amount0.scaleBy(18, Helpers.getDecimals(token0));
        value += amount1.scaleBy(18, Helpers.getDecimals(token1));
    }

    /***************************************
            Withdraw
    ****************************************/
    /**
     * @notice Calculates the amount liquidity that needs to be removed
     *          to Withdraw specified amount of the given asset.
     *
     * @param position  Position object
     * @param asset    Token needed
     * @param amount    Minimum amount to liquidate
     *
     * @return liquidity    Liquidity to burn
     * @return minAmount0   Minimum amount0 to expect
     * @return minAmount1   Minimum amount1 to expect
     */
    function _calculateLiquidityToWithdraw(
        Position memory position,
        address asset,
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

        if (asset == token0) {
            minAmount0 = amount;
            minAmount1 = totalAmount1 / (totalAmount0 / amount);
            liquidity = helper.getLiquidityForAmounts(
                sqrtRatioX96,
                position.sqrtRatioAX96,
                position.sqrtRatioBX96,
                amount,
                minAmount1
            );
        } else if (asset == token1) {
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

    /**
     * @notice Liquidiates active position to remove required amount of give asset
     * @dev Doesn't have non-Reentrant modifier since it's supposed to be delegatecalled
     *      only from `UniswapV3Strategy.withdraw` which already has a nonReentrant check
     *      and the storage is shared between these two contract.
     *
     * @param asset Asset address
     * @param amount Min amount of token to receive
     */
    function withdrawAssetFromActivePositionOnlyVault(
        address asset,
        uint256 amount
    ) external onlyVault {
        Position memory position = tokenIdToPosition[activeTokenId];
        require(position.exists && position.liquidity > 0, "Liquidity error");

        // Figure out liquidity to burn
        (
            uint128 liquidity,
            uint256 minAmount0,
            uint256 minAmount1
        ) = _calculateLiquidityToWithdraw(position, asset, amount);

        // NOTE: The minAmount is calculated using the current pool price.
        // It can be tilted and a large amount OUSD can be redeemed to make the strategy
        // liquidate positions on the tilted pool.
        // However, we don't plan on making this the default strategy. So, this method
        // would never be invoked on prod.
        // TODO: Should we still a slippage (just in case it becomes a default strategy in future)?

        // Liquidiate active position
        _decreasePositionLiquidity(
            position.tokenId,
            liquidity,
            minAmount0,
            minAmount1
        );
    }

    /***************************************
            Rebalance
    ****************************************/
    /// Reverts if active position's value is greater than maxTVL
    function ensureTVL() internal {
        require(
            getPositionValue(activeTokenId) <= maxTVL,
            "MaxTVL threshold has been reached"
        );
    }

    /**
     * @notice Reverts if swaps are paused or if swapping constraints aren't met.
     * @param sqrtPriceLimitX96 Desired swap price limit
     * @param swapZeroForOne True when swapping token0 for token1
     */
    function swapsNotPausedAndWithinLimits(
        uint160 sqrtPriceLimitX96,
        bool swapZeroForOne
    ) internal {
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

    /// Reverts if rebalances are paused
    function rebalanceNotPaused() internal {
        require(!rebalancePaused, "Rebalances are paused");
    }

    /**
     * @notice Reverts if rebalances are paused or if rebalance constraints aren't met.
     * @param upperTick Upper tick index
     * @param lowerTick Lower tick inded
     */
    function rebalanceNotPausedAndWithinLimits(int24 lowerTick, int24 upperTick)
        internal
    {
        require(!rebalancePaused, "Rebalances are paused");
        require(
            minRebalanceTick <= lowerTick && maxRebalanceTick >= upperTick,
            "Rebalance position out of bounds"
        );
    }

    /**
     * @notice Update the netLostValue state.
     *
     * If the value of position increase multiple times without a drop in value,
     * the counter would still be at zero. We don't keep track of any value gained
     * until the counter is > 0, as the only purpose of this state variable is
     * to shut off rebalancing if the LP positions are losing capital across rebalances.
     *
     * @param delta The unsigned change in value
     * @param gained True, if sign of delta is positive
     */
    function _setNetLostValue(uint256 delta, bool gained) internal {
        if (delta == 0) {
            // No change
            return;
        }

        if (gained) {
            if (netLostValue == 0) {
                // No change
                return;
            } else if (delta >= netLostValue) {
                // Reset lost value
                netLostValue = 0;
            } else {
                // Deduct gained amount from netLostValue
                netLostValue -= delta;
            }
        } else {
            // Add lost value
            netLostValue += delta;
        }

        emit NetLostValueChanged(netLostValue);
    }

    /**
     * @notice Computes the current value of the given token and updates
     *          the storage. Also, updates netLostValue state
     * @param tokenId Token ID of the position
     */
    function updatePositionNetVal(uint256 tokenId) internal {
        if (tokenId == 0) {
            return;
        }

        uint256 currentVal = getPositionValue(tokenId);
        uint256 lastVal = tokenIdToPosition[tokenId].netValue;

        if (currentVal == lastVal) {
            // No change in value
            return;
        }

        if (currentVal > lastVal) {
            _setNetLostValue(currentVal - lastVal, true);
        } else {
            _setNetLostValue(lastVal - currentVal, false);
        }

        // NOTE: Intentionally skipped passing the `int256 delta` to `_setNetLostValue`,
        // Wanna be safe about uint() to int() conversions.
        emit PositionValueChanged(
            tokenId,
            lastVal,
            currentVal,
            int256(currentVal) - int256(lastVal)
        );

        // Update state
        tokenIdToPosition[tokenId].netValue = currentVal;
    }

    /**
     * @notice Updates the value of the current position.
     *         Reverts if netLostValue threshold is breached.
     * @param tokenId Token ID of the position
     */
    function ensureNetLossThreshold(uint256 tokenId) internal {
        updatePositionNetVal(tokenId);
        require(
            netLostValue < maxPositionValueLostThreshold,
            "Over max value loss threshold"
        );
    }

    /**
     * @notice Closes active LP position if any and then provides liquidity to the requested position.
     *         Mints new position, if it doesn't exist already. If active position is on the same tick
     *         range, then just increases the liquidity by the desiredAmounts
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
    ) external onlyGovernorOrStrategistOrOperator nonReentrant {
        require(lowerTick < upperTick, "Invalid tick range");
        rebalanceNotPausedAndWithinLimits(lowerTick, upperTick);

        int48 tickKey = _getTickPositionKey(lowerTick, upperTick);
        uint256 tokenId = ticksToTokenId[tickKey];

        if (activeTokenId > 0 && activeTokenId != tokenId) {
            // Close any active position (if it's not the same)
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
        _depositAll();

        // Final position value/sanity check
        ensureTVL();
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

    /**
     * @notice Closes active LP position if any and then provides liquidity to the requested position.
     *         Mints new position, if it doesn't exist already. If active position is on the same tick
     *         range, then just increases the liquidity by the desiredAmounts. Will pull funds needed
     *         from reserve strategies and then will deposit back all dust to them
     * @param params.desiredAmount0 Amount of token0 to use to provide liquidity
     * @param params.desiredAmount1 Amount of token1 to use to provide liquidity
     * @param params.minAmount0 Min amount of token0 to deposit/expect
     * @param params.minAmount1 Min amount of token1 to deposit/expect
     * @param params.minRedeemAmount0 Min amount of token0 received from closing active position
     * @param params.minRedeemAmount1 Min amount of token1 received from closing active position
     * @param params.lowerTick Desired lower tick index
     * @param params.upperTick Desired upper tick index
     * @param params.swapAmountIn Amount of tokens to swap
     * @param params.swapMinAmountOut Minimum amount of other tokens expected
     * @param params.sqrtPriceLimitX96 Max price limit for swap
     * @param params.swapZeroForOne True if swapping from token0 to token1
     */
    function swapAndRebalance(SwapAndRebalanceParams calldata params)
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
    {
        require(params.lowerTick < params.upperTick, "Invalid tick range");
        swapsNotPausedAndWithinLimits(
            params.sqrtPriceLimitX96,
            params.swapZeroForOne
        );
        rebalanceNotPausedAndWithinLimits(params.lowerTick, params.upperTick);

        uint256 tokenId = ticksToTokenId[
            _getTickPositionKey(params.lowerTick, params.upperTick)
        ];

        if (activeTokenId > 0 && activeTokenId != tokenId) {
            // Close any active position (if it's not the same)
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
        _depositAll();

        // Final position value/sanity check
        ensureTVL();
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

        // Make sure liquidity management is disabled when value lost threshold is breached
        ensureNetLossThreshold(0);

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
            sqrtRatioBX96: helper.getSqrtRatioAtTick(upperTick),
            netValue: _getValueOfTokens(amount0, amount1)
        });

        emit UniswapV3PositionMinted(tokenId, lowerTick, upperTick);
        emit UniswapV3LiquidityAdded(tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Increases liquidity of the given token.
     *
     * @param tokenId Position NFT's tokenId
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     *
     * @return liquidity Amount of liquidity added
     * @return amount0 Amount of token0 deposited
     * @return amount1 Amount of token1 deposited
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

        // Make sure liquidity management is disabled when value lost threshold is breached
        ensureNetLossThreshold(tokenId);

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
        // Update last known value
        position.netValue = getPositionValue(tokenId);

        emit UniswapV3LiquidityAdded(tokenId, amount0, amount1, liquidity);
    }

    /**
     * @notice Increases liquidity of the active position token.
     *         Will pull funds needed from reserve strategies if needed.
     *
     * @param desiredAmount0 Desired amount of token0 to provide liquidity
     * @param desiredAmount1 Desired amount of token1 to provide liquidity
     * @param minAmount0 Min amount of token0 to deposit
     * @param minAmount1 Min amount of token1 to deposit
     *
     * @return amount0 Amount of token0 deposited
     * @return amount1 Amount of token1 deposited
     */
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
        rebalanceNotPaused();

        // Withdraw enough funds from Reserve strategies
        _ensureAssetBalances(desiredAmount0, desiredAmount1);

        _increasePositionLiquidity(
            activeTokenId,
            desiredAmount0,
            desiredAmount1,
            minAmount0,
            minAmount1
        );

        // Deposit
        _depositAll();

        // Final position value/sanity check
        ensureTVL();
    }

    /**
     * @notice Removes liquidity of the position in the pool
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

        // Update net value loss (to capture the state value before updating it).
        // Also allows to close/decrease liquidity even if beyond the net loss threshold.
        updatePositionNetVal(tokenId);

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
        // Update last known value
        position.netValue = getPositionValue(tokenId);

        emit UniswapV3LiquidityRemoved(
            position.tokenId,
            amount0,
            amount1,
            liquidity
        );
    }

    /**
     * @notice Removes liquidity of the active position in the pool
     *
     * @param liquidity Amount of liquidity to remove form the position
     * @param minAmount0 Min amount of token0 to withdraw
     * @param minAmount1 Min amount of token1 to withdraw
     *
     * @return amount0 Amount of token0 received after liquidation
     * @return amount1 Amount of token1 received after liquidation
     */
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
        rebalanceNotPaused();

        (amount0, amount1) = _decreasePositionLiquidity(
            activeTokenId,
            liquidity,
            minAmount0,
            minAmount1
        );

        // Deposit
        _depositAll();

        // Intentionally skipping TVL check since removing liquidity won't cause it to fail
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
        external
        onlyGovernorOrStrategistOrOperator
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        return _closePosition(tokenId, minAmount0, minAmount1);

        // Intentionally skipping TVL check since removing liquidity won't cause it to fail
    }

    /**
     * @notice Same as closePosition but only callable by Vault
     * @dev Doesn't have non-Reentrant modifier since it's supposed to be delegatecalled
     *      only from `UniswapV3Strategy.withdrawAll` which already has a nonReentrant check
     *      and the storage is shared between these two contract.
     */
    function closeActivePositionOnlyVault()
        external
        onlyVault
        returns (uint256 amount0, uint256 amount1)
    {
        // Since this is called by the Vault, we cannot pass min redeem amounts
        // without complicating the code of the Vault. So, passing 0 instead.
        // A better way
        return _closePosition(activeTokenId, 0, 0);

        // Intentionally skipping TVL check since removing liquidity won't cause it to fail
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
    }

    /**
     * @dev Swaps one token for other and then provides liquidity to pools.
     *
     * @param desiredAmount0 Minimum amount of token0 needed
     * @param desiredAmount1 Minimum amount of token1 needed
     * @param swapAmountIn Amount of tokens to swap
     * @param swapMinAmountOut Minimum amount of other tokens expected
     * @param sqrtPriceLimitX96 Max price limit for swap
     * @param swapZeroForOne True if swapping from token0 to token1
     */
    function _ensureAssetsBySwapping(
        uint256 desiredAmount0,
        uint256 desiredAmount1,
        uint256 swapAmountIn,
        uint256 swapMinAmountOut,
        uint160 sqrtPriceLimitX96,
        bool swapZeroForOne
    ) internal {
        require(!swapsPaused, "Swaps are paused");

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
            uint256 t1ReserveBal = reserveStrategy1.checkBalance(token1);

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
            uint256 t0ReserveBal = reserveStrategy0.checkBalance(token0);

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
    }

    /**
     * @notice Collects the fees generated by the position on V3 pool.
     *         Also adjusts netLostValue based on fee collected.
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

        // Reset loss counter to include value of fee collected
        _setNetLostValue(_getValueOfTokens(amount0, amount1), true);

        emit UniswapV3FeeCollected(tokenId, amount0, amount1);
    }

    /**
     * @notice Collects fees from the active LP position
     * @return amount0 Amount of token0 collected as fee
     * @return amount1 Amount of token1 collected as fee
     */
    function collectFees()
        external
        onlyGovernorOrStrategistOrOperator
        returns (uint256 amount0, uint256 amount1)
    {
        return _collectFeesForToken(activeTokenId);
    }

    /***************************************
            Hidden functions
    ****************************************/
    function _abstractSetPToken(address, address) internal override {
        revert("NO_IMPL");
    }

    function safeApproveAllTokens() external override {
        revert("NO_IMPL");
    }

    function deposit(address, uint256) external override {
        revert("NO_IMPL");
    }

    function depositAll() external override {
        revert("NO_IMPL");
    }

    function withdrawAll() external override {
        revert("NO_IMPL");
    }

    function withdraw(
        address,
        address,
        uint256
    ) external override {
        revert("NO_IMPL");
    }

    function checkBalance(address) external view override returns (uint256) {
        revert("NO_IMPL");
    }

    function supportsAsset(address) external view override returns (bool) {
        revert("NO_IMPL");
    }

    function setPTokenAddress(address, address) external override {
        revert("NO_IMPL");
    }

    function removePToken(uint256) external override {
        revert("NO_IMPL");
    }

    function collectRewardTokens() external override {
        revert("NO_IMPL");
    }
}
