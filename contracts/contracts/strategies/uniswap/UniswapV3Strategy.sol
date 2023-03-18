// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { UniswapV3StrategyStorage } from "./UniswapV3StrategyStorage.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IStrategy } from "../../interfaces/IStrategy.sol";
import { IVault } from "../../interfaces/IVault.sol";

import { INonfungiblePositionManager } from "../../interfaces/uniswap/v3/INonfungiblePositionManager.sol";
import { IUniswapV3Helper } from "../../interfaces/uniswap/v3/IUniswapV3Helper.sol";
import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { IUniswapV3Strategy } from "../../interfaces/IUniswapV3Strategy.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { Helpers } from "../../utils/Helpers.sol";

contract UniswapV3Strategy is UniswapV3StrategyStorage {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev Initialize the contract
     * @param _vaultAddress OUSD Vault
     * @param _poolAddress Uniswap V3 Pool
     * @param _nonfungiblePositionManager Uniswap V3's Position Manager
     * @param _helper Deployed UniswapV3Helper contract
     * @param _swapRouter Uniswap SwapRouter contract
     * @param _operator Operator address
     */
    function initialize(
        address _vaultAddress,
        address _poolAddress,
        address _nonfungiblePositionManager,
        address _helper,
        address _swapRouter,
        address _operator
    ) external onlyGovernor initializer {
        // TODO: Comment on why this is necessary and why it should always be the proxy address
        _self = IUniswapV3Strategy(address(this));

        pool = IUniswapV3Pool(_poolAddress);
        helper = IUniswapV3Helper(_helper);
        swapRouter = ISwapRouter(_swapRouter);
        positionManager = INonfungiblePositionManager(
            _nonfungiblePositionManager
        );

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
            reserveStrategy: address(0), // Set using `setReserveStrategy()`
            minDepositThreshold: 0
        });

        poolTokens[token1] = PoolToken({
            isSupported: true,
            reserveStrategy: address(0), // Set using `setReserveStrategy()
            minDepositThreshold: 0
        });

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
     * @notice Change the reserve strategy of the supported asset
     * @dev Will throw if the strategies don't support the assets or if
     *      strategy is unsupported by the vault
     * @param _asset Asset to set the reserve strategy for
     * @param _reserveStrategy The new reserve strategy for token
     */
    function setReserveStrategy(address _asset, address _reserveStrategy)
        external
        onlyGovernorOrStrategist
        onlyPoolTokens(_asset)
        nonReentrant
    {
        require(
            IVault(vaultAddress).isStrategySupported(_reserveStrategy),
            "Unsupported strategy"
        );

        require(
            IStrategy(_reserveStrategy).supportsAsset(_asset),
            "Invalid strategy for asset"
        );

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
        reserveStrategyAddr = poolTokens[_asset].reserveStrategy;
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

    /**
     * @notice Toggle rebalance methods
     * @param _paused True if rebalance has to be paused
     */
    function setRebalancePaused(bool _paused)
        external
        onlyGovernorOrStrategist
    {
        rebalancePaused = _paused;
        emit RebalancePauseStatusChanged(_paused);
    }

    /**
     * @notice Toggle swapAndRebalance method
     * @param _paused True if swaps have to be paused
     */
    function setSwapsPaused(bool _paused) external onlyGovernorOrStrategist {
        swapsPaused = _paused;
        emit SwapsPauseStatusChanged(_paused);
    }

    /**
     * @notice Change the maxTVL amount threshold
     * @param _maxTVL Maximum amount the strategy can have deployed in the Uniswap pool
     */
    function setMaxTVL(uint256 _maxTVL)
        external
        onlyGovernorOrStrategist
    {
        maxTVL = _maxTVL;
        emit MaxTVLChanged(_maxTVL);
    }

    /**
     * @notice Change the rebalance price threshold
     * @param minTick Minimum price tick index
     * @param maxTick Maximum price tick index
     */
    function setRebalancePriceThreshold(int24 minTick, int24 maxTick)
        external
        onlyGovernorOrStrategist
    {
        require((minTick < maxTick), "Invalid threshold");
        minRebalanceTick = minTick;
        maxRebalanceTick = maxTick;
        emit RebalancePriceThresholdChanged(
            minTick,
            helper.getSqrtRatioAtTick(minTick),
            maxTick,
            helper.getSqrtRatioAtTick(maxTick)
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
        onlyPoolTokens(_asset)
        nonReentrant
    {
        if (_amount > poolTokens[_asset].minDepositThreshold) {
            IVault(vaultAddress).depositToUniswapV3Reserve(_asset, _amount);
            // Not emitting Deposit event since the Reserve strategy would do so
        }
    }

    /// @inheritdoc InitializableAbstractStrategy
    function depositAll() external override onlyVault nonReentrant {
        _depositAll();
    }

    /**
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdraw(
        address recipient,
        address _asset,
        uint256 amount
    ) external override onlyVault onlyPoolTokens(_asset) nonReentrant {
        revert("NO_IMPL");
    }

    /**
     * @notice Closes active LP position, if any, and transfer all token balance to Vault
     * @inheritdoc InitializableAbstractStrategy
     */
    function withdrawAll() external virtual override {
        revert("NO_IMPL");
    }

    /***************************************
            Balances and Fees
    ****************************************/
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
        if (activeTokenId > 0) {
            (amount0, amount1) = helper.positionFees(
                positionManager,
                address(pool),
                activeTokenId
            );
        }
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

        if (activeTokenId > 0) {
            require(tokenIdToPosition[activeTokenId].exists, "Invalid token");

            (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
            (uint256 amount0, uint256 amount1) = helper.positionValue(
                positionManager,
                address(pool),
                activeTokenId,
                sqrtRatioX96
            );

            if (_asset == token0) {
                balance += amount0;
            } else if (_asset == token1) {
                balance += amount1;
            }
        }

        uint256 assetDecimals = Helpers.getDecimals(_asset);
        balance = balance.scaleBy(18, assetDecimals);
    }

    function checkBalanceOfAllAssets()
        external
        view
        returns (uint256 amount0, uint256 amount1)
    {
        if (activeTokenId > 0) {
            require(tokenIdToPosition[activeTokenId].exists, "Invalid token");

            (uint160 sqrtRatioX96, , , , , , ) = pool.slot0();
            (amount0, amount1) = helper.positionValue(
                positionManager,
                address(pool),
                activeTokenId,
                sqrtRatioX96
            );
        }

        amount0 += IERC20(token0).balanceOf(address(this));
        amount1 += IERC20(token1).balanceOf(address(this));

        uint256 asset0Decimals = Helpers.getDecimals(token0);
        uint256 asset1Decimals = Helpers.getDecimals(token1);
        amount0 = amount0.scaleBy(18, asset0Decimals);
        amount1 = amount1.scaleBy(18, asset1Decimals);
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
        IERC20(token0).safeApprove(address(swapRouter), type(uint256).max);
        IERC20(token1).safeApprove(address(swapRouter), type(uint256).max);
    }

    /**
     * Removes all allowance of both the tokens from NonfungiblePositionManager
     */
    function resetAllowanceOfTokens() external onlyGovernor nonReentrant {
        IERC20(token0).safeApprove(address(positionManager), 0);
        IERC20(token1).safeApprove(address(positionManager), 0);
        IERC20(token0).safeApprove(address(swapRouter), 0);
        IERC20(token1).safeApprove(address(swapRouter), 0);
    }

    /// @inheritdoc InitializableAbstractStrategy
    function _abstractSetPToken(address _asset, address) internal override {
        IERC20(_asset).safeApprove(vaultAddress, type(uint256).max);
        IERC20(_asset).safeApprove(address(positionManager), type(uint256).max);
        IERC20(_asset).safeApprove(address(swapRouter), type(uint256).max);
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

    /***************************************
            Proxy to liquidity management
    ****************************************/
    /**
     * @dev Sets the implementation for the liquidity manager
     * @param newImpl address of the implementation
     */
    function setLiquidityManagerImpl(address newImpl) external onlyGovernor {
        _setLiquidityManagerImpl(newImpl);
    }

    function _setLiquidityManagerImpl(address newImpl) internal {
        require(
            Address.isContract(newImpl),
            "new implementation is not a contract"
        );
        bytes32 position = liquidityManagerImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(position, newImpl)
        }
    }

    /**
     * @dev Falldown to the liquidity manager implementation
     * @notice This is a catch all for all functions not declared here
     */
    // solhint-disable-next-line no-complex-fallback
    fallback() external payable {
        bytes32 slot = liquidityManagerImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(
                gas(),
                sload(slot),
                0,
                calldatasize(),
                0,
                0
            )

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
