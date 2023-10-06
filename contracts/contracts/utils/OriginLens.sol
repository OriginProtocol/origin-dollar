// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { Initializable } from "./Initializable.sol";
import { IERC20 } from "./InitializableAbstractStrategy.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOUSD } from "../interfaces/IOUSD.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IRewardStaking } from "../strategies/IRewardStaking.sol";
import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../interfaces/balancer/IRateProvider.sol";
import { IWstETH } from "../interfaces/IWstETH.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IMetaStablePool } from "../interfaces/balancer/IMetaStablePool.sol";
import { StableMath } from "./StableMath.sol";

contract OriginLens is Initializable, Strategizable {
    using StableMath for uint256;

    enum StrategyKinds {
        Generic,
        CurveAMO,
        BalancerMetaStablePool,
        BalancerComposableStablePool
    }

    struct StrategyConfig {
        bool supported;
        StrategyKinds kind;
    }

    event StrategyTypeChanged(address indexed strategyAddr, StrategyKinds kind);

    address[] public strategies;
    address[] public assets;

    mapping(address => StrategyConfig) public strategyConfig;

    IVault public immutable vault;
    IOUSD public immutable oToken;
    uint256 public immutable assetCount;
    IOracle public immutable oracleRouter;

    constructor(address _oToken) {
        require(_oToken != address(0), "Invalid OToken address");
        oToken = IOUSD(_oToken);
        IVault _vault = IVault(IOUSD(_oToken).vaultAddress());
        vault = _vault;

        assetCount = _vault.getAssetCount();
        oracleRouter = IOracle(_vault.priceProvider());

        // Nobody owns the Implementation contract
        _setGovernor(address(0));
    }

    function initialize(address _strategistAddr)
        external
        onlyGovernor
        initializer
    {
        require(_strategistAddr != address(0), "Invalid strategist address");
        _setStrategistAddr(_strategistAddr);

        // Cache assets and strategies
        assets = vault.getAllAssets();
        cacheStrategies();
    }

    function setStrategyType(address strategy, StrategyKinds kind)
        public
        onlyGovernorOrStrategist
    {
        StrategyConfig storage config = strategyConfig[strategy];
        require(config.supported, "Unsupported strategy");

        config.kind = kind;

        emit StrategyTypeChanged(strategy, kind);
    }

    function cacheStrategies() public {
        address[] memory vaultStrategies = vault.getAllStrategies();

        // Mark all existing strategies as unsupported.
        // Takes care of any strategies removed from the Vault
        for (uint256 i = 0; i < strategies.length; ++i) {
            strategyConfig[strategies[i]].supported = false;
        }

        // Mark everything on Vault as supported
        for (uint256 i = 0; i < vaultStrategies.length; ++i) {
            StrategyConfig storage config = strategyConfig[vaultStrategies[i]];
            config.supported = true;
            // Either retains the `kind` from previous configuration or
            // is set to `0` (or `Generic`) as the fallback value.
        }

        // Reset the strategies array
        strategies = vaultStrategies;
    }

    function getStrategyBalances(address strategyAddr)
        public
        view
        returns (
            address[] memory supportedAssets,
            uint256[] memory assetBalances
        )
    {
        StrategyConfig memory config = strategyConfig[strategyAddr];
        require(config.supported, "Unsupported strategy");

        IStrategy strategy = IStrategy(strategyAddr);

        address[] memory _supportedAssets = new address[](assetCount);

        uint256 j = 0;
        for (uint256 i = 0; i < assetCount; ++i) {
            address asset = assets[i];
            if (strategy.supportsAsset(asset)) {
                _supportedAssets[j] = asset;
                ++j;
            }
        }

        supportedAssets = new address[](j);
        assetBalances = new uint256[](j);
        for (uint256 i = 0; i < j; ++i) {
            address asset = _supportedAssets[i];
            supportedAssets[i] = asset;
            assetBalances[i] = _getStrategyAssetBalance(
                strategy,
                asset,
                config
            );
        }
    }

    function getStrategyAssetBalance(address strategyAddr, address asset)
        public
        view
        returns (uint256 balance)
    {
        StrategyConfig memory config = strategyConfig[strategyAddr];
        require(config.supported, "Unsupported strategy");

        IStrategy strategy = IStrategy(strategyAddr);
        require(strategy.supportsAsset(asset), "Unsupported asset");

        return _getStrategyAssetBalance(strategy, asset, config);
    }

    function _getStrategyAssetBalance(
        IStrategy strategy,
        address asset,
        StrategyConfig memory config
    ) internal view returns (uint256 balance) {
        if (config.kind == StrategyKinds.CurveAMO) {
            return _getCurveAMOPoolAssetBalance(strategy, asset);
        } else if (config.kind == StrategyKinds.BalancerMetaStablePool) {
            return _getBalancerMetaStablePoolAssetBalance(strategy, asset);
        } else if (config.kind == StrategyKinds.BalancerComposableStablePool) {
            return
                _getBalancerComposableStablePoolAssetBalance(strategy, asset);
        }

        return strategy.checkBalance(asset);
    }

    function _getCurveAMOPoolAssetBalance(IStrategy strategy, address asset)
        internal
        view
        returns (uint256 balance)
    {
        //
    }

    function _getBalancerMetaStablePoolAssetBalance(
        IStrategy strategy,
        address asset
    ) internal view returns (uint256 balance) {
        // Get the entire balance in base token (WETH)
        balance = strategy.checkBalance();

        (IERC20[] memory tokens, uint256[] memory balances, ) = IBalancerVault(
            strategy.balancerVault()
        ).getPoolTokens(strategy.balancerPoolId());
        IRateProvider[] memory providers = IMetaStablePool(
            strategy.platformAddress()
        ).getRateProviders();

        uint256 priceAdjustedAssetBalance;
        uint256 assetRate = 1 ether;

        uint256 totalPoolValue;
        for (uint256 i = 0; i < tokens.length; ++i) {
            uint256 tokenBalance = balances[i];
            uint256 _rate = 1 ether;

            if (address(providers[i]) != address(0)) {
                _rate = providers[i].getRate();
                tokenBalance = tokenBalance.divPrecisely(_rate);
            }

            if (address(tokens[i]) == asset) {
                assetRate = _rate;
                priceAdjustedAssetBalance = tokenBalance;
            }

            totalPoolValue += tokenBalance;
        }

        // `asset` redeemabe with LP tokens owned
        balance = balance.mulTruncateScale(
            // Split of asset scaled to 1e8 for accuracy
            ((1e8 * priceAdjustedAssetBalance) / totalPoolValue),
            1e8
        );

        balance = balance.mulTruncateScale(
            // WETH to `asset` rate conversion
            balance * assetRate,
            1 ether
        );
    }

    function _getBalancerComposableStablePoolAssetBalance(
        IStrategy strategy,
        address asset
    ) internal view returns (uint256 balance) {
        // TODO: After that strategy is deployed
    }
}
