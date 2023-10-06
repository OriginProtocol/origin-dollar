// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { Initializable } from "./Initializable.sol";
import { IERC20 } from "./InitializableAbstractStrategy.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IOUSD } from "../interfaces/IOUSD.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { IRewardStaking } from "../strategies/IRewardStaking.sol";
import { ICurvePool } from "../strategies/ICurvePool.sol";
import { IBalancerVault } from "../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../interfaces/balancer/IRateProvider.sol";
import { IWstETH } from "../interfaces/IWstETH.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IMetaStablePool } from "../interfaces/balancer/IMetaStablePool.sol";
import { StableMath } from "./StableMath.sol";
import { console } from "hardhat/console.sol";

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

    address public constant ETH_ADDR =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

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

    function initialize(address _strategistAddr, address[] calldata _strategies, uint8[] calldata strategyKinds)
        external
        onlyGovernor
        initializer
    {
        require(_strategistAddr != address(0), "Invalid strategist address");
        _setStrategistAddr(_strategistAddr);

        // Cache assets and strategies
        assets = vault.getAllAssets();
        cacheStrategies();

        for (uint256 i = 0; i < _strategies.length; ++i) {
            _setStrategyKind(_strategies[i], StrategyKinds(strategyKinds[i]));
        }
    }

    function setStrategyKind(address strategy, StrategyKinds kind)
        external
        onlyGovernorOrStrategist
    {
        _setStrategyKind(strategy, kind);
    }

    function _setStrategyKind(address strategy, StrategyKinds kind)
        internal
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

        if (config.kind == StrategyKinds.CurveAMO) {
            return _getCurveAMOPoolBalance(strategy);
        } else if (config.kind == StrategyKinds.BalancerMetaStablePool) {
            return _getBalancerMetaStablePoolBalance(strategy);
        }

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
        // require(strategy.supportsAsset(asset), "Unsupported asset");

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

    function _getCurveAMOPoolBalance(IStrategy strategy)
        internal
        view
        returns (
            address[] memory supportedAssets,
            uint256[] memory assetBalances
        )
    {
        ICurvePool pool = ICurvePool(strategy.platformAddress());
        console.log(">>>>>>>>>> %s", address(pool));

        uint256[] memory poolCoinBalance = pool.get_balances(); // Balance in pool

        console.log(">>>>>>>>>> %s", poolCoinBalance.length);

        supportedAssets = new address[](poolCoinBalance.length);
        assetBalances =  new uint256[](poolCoinBalance.length);

        console.log(">>>>>>>>>> %s", strategy.cvxRewardStaker());

        // Staked LP tokens balance
        uint256 strategyBalance = IRewardStaking(strategy.cvxRewardStaker())
            .balanceOf(address(strategy));

        console.log(">>>>>>>>>> %s", strategyBalance);

        uint256 totalPoolValue;
        for (uint256 i = 0; i < poolCoinBalance.length; ++i) {
            address asset = pool.coins(i);
            supportedAssets[i] = asset;
            // TODO: Assuming 18 decimals always, which might not be true for OUSD
            totalPoolValue += poolCoinBalance[i];

            // Unstaked LP tokens balance
            if (asset != address(oToken)) {
                address pToken = strategy.assetToPToken(asset);
                strategyBalance += IERC20(pToken).balanceOf(address(strategy));

                // Always return ETH as WETH
                if (asset == ETH_ADDR) {
                    supportedAssets[i] = pToken;
                }
            }
        }

        // Total LP tokens * Virtual price
        strategyBalance = strategyBalance.mulTruncateScale(
            pool.get_virtual_price(),
            1 ether // 18 decimals assumption
        );

        // Compute split owned by strategy
        for (uint256 i = 0; i < supportedAssets.length; ++i) {
            assetBalances[i] = strategyBalance.mulTruncateScale(
                (1e8 * poolCoinBalance[i]) / totalPoolValue, // Split of asset scaled to 1e8 for accuracy
                1e8
            );
        }
    }

    function _getCurveAMOPoolAssetBalance(IStrategy strategy, address asset)
        internal
        view
        returns (uint256 balance)
    {
        (
            address[] memory coins,
            uint256[] memory balances
        ) = _getCurveAMOPoolBalance(strategy);
        for (uint256 i = 0; i < coins.length; ++i) {
            if (coins[i] == asset) {
                return balances[i];
            }
        }

        require(false, "Unsupported asset");
    }

    function _getBalancerMetaStablePoolBalance(IStrategy strategy)
        internal
        view
        returns (
            address[] memory supportedAssets,
            uint256[] memory assetBalances
        )
    {
        // Get the entire balance in base token (WETH)
        uint256 totalValueInStrategy = strategy.checkBalance();

        (IERC20[] memory tokens, uint256[] memory balances, ) = IBalancerVault(
            strategy.balancerVault()
        ).getPoolTokens(strategy.balancerPoolId());
        IRateProvider[] memory providers = IMetaStablePool(
            strategy.platformAddress()
        ).getRateProviders();

        supportedAssets = new address[](tokens.length);
        assetBalances = new uint256[](tokens.length);

        uint256[] memory assetRates = new uint256[](tokens.length);

        uint256 totalPoolValue;
        for (uint256 i = 0; i < tokens.length; ++i) {
            uint256 tokenBalance = balances[i];
            uint256 _rate = 1 ether;

            supportedAssets[i] = address(tokens[i]);

            if (address(providers[i]) != address(0)) {
                _rate = providers[i].getRate();
                tokenBalance = tokenBalance.divPrecisely(_rate);
            }

            assetRates[i] = _rate;
            assetBalances[i] = tokenBalance; // Value of token in ETH
            totalPoolValue += tokenBalance;
        }

        for (uint256 i = 0; i < tokens.length; ++i) {
            // Value of `tokens[i]` in strategy
            assetBalances[i] = totalValueInStrategy
                .mulTruncateScale(
                    // Split of asset scaled to 1e8 for accuracy
                    ((1e8 * assetBalances[i]) / totalPoolValue),
                    1e8
                )
                .divPrecisely(
                    // WETH to `tokens[i]` Rate conversion
                    assetRates[i]
                );
        }
    }

    function _getBalancerMetaStablePoolAssetBalance(
        IStrategy strategy,
        address asset
    ) internal view returns (uint256 balance) {
        (
            address[] memory tokens,
            uint256[] memory balances
        ) = _getBalancerMetaStablePoolBalance(strategy);
        for (uint256 i = 0; i < tokens.length; ++i) {
            if (tokens[i] == asset) {
                return balances[i];
            }
        }

        require(false, "Unsupported asset");
    }

    function _getBalancerComposableStablePoolAssetBalance(IStrategy, address)
        internal
        view
        returns (uint256)
    {
        // TODO: After that strategy is deployed
        require(false, "Not implemented");
    }
}
