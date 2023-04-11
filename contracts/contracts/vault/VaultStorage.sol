// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OUSD VaultStorage Contract
 * @notice The VaultStorage contract defines the storage for the Vault contracts
 * @author Origin Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { Governable } from "../governance/Governable.sol";
import { OUSD } from "../token/OUSD.sol";
import { Initializable } from "../utils/Initializable.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IGetExchangeRateToken } from "../interfaces/IGetExchangeRateToken.sol";

contract VaultStorage is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeMath for int256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetDefaultStrategyUpdated(address _asset, address _strategy);
    event AssetAllocated(address _asset, address _strategy, uint256 _amount);
    event StrategyApproved(address _addr);
    event StrategyRemoved(address _addr);
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event CapitalPaused();
    event CapitalUnpaused();
    event RebasePaused();
    event RebaseUnpaused();
    event VaultBufferUpdated(uint256 _vaultBuffer);
    event OusdMetaStrategyUpdated(address _ousdMetaStrategy);
    event RedeemFeeUpdated(uint256 _redeemFeeBps);
    event PriceProviderUpdated(address _priceProvider);
    event AllocateThresholdUpdated(uint256 _threshold);
    event RebaseThresholdUpdated(uint256 _threshold);
    event StrategistUpdated(address _address);
    event MaxSupplyDiffChanged(uint256 maxSupplyDiff);
    event YieldDistribution(address _to, uint256 _yield, uint256 _fee);
    event TrusteeFeeBpsChanged(uint256 _basis);
    event TrusteeAddressChanged(address _address);
    event NetOusdMintForStrategyThresholdChanged(uint256 _threshold);

    // Assets supported by the Vault, i.e. Stablecoins
    enum UnitConversion {
        DECIMALS,
        GETEXCHANGERATE
    }
    struct Asset {
        bool isSupported;
        UnitConversion unitConversion;
    }
    mapping(address => Asset) internal assets;
    address[] internal allAssets;

    // Strategies approved for use by the Vault
    struct Strategy {
        bool isSupported;
        uint256 _deprecated; // Deprecated storage slot
    }
    mapping(address => Strategy) internal strategies;
    address[] internal allStrategies;

    // Address of the Oracle price provider contract
    address public priceProvider;
    // Pausing bools
    bool public rebasePaused = false;
    bool public capitalPaused = true;
    // Redemption fee in basis points
    uint256 public redeemFeeBps;
    // Buffer of assets to keep in Vault to handle (most) withdrawals
    uint256 public vaultBuffer;
    // Mints over this amount automatically allocate funds. 18 decimals.
    uint256 public autoAllocateThreshold;
    // Mints over this amount automatically rebase. 18 decimals.
    uint256 public rebaseThreshold;

    OUSD internal oUSD;

    //keccak256("OUSD.vault.governor.admin.impl");
    bytes32 constant adminImplPosition =
        0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    // Address of the contract responsible for post rebase syncs with AMMs
    address private _deprecated_rebaseHooksAddr = address(0);

    // Deprecated: Address of Uniswap
    // slither-disable-next-line constable-states
    address private _deprecated_uniswapAddr = address(0);

    // Address of the Strategist
    address public strategistAddr = address(0);

    // Mapping of asset address to the Strategy that they should automatically
    // be allocated to
    mapping(address => address) public assetDefaultStrategies;

    uint256 public maxSupplyDiff;

    // Trustee contract that can collect a percentage of yield
    address public trusteeAddress;

    // Amount of yield collected in basis points
    uint256 public trusteeFeeBps;

    // Deprecated: Tokens that should be swapped for stablecoins
    address[] private _deprecated_swapTokens;

    uint256 constant MINT_MINIMUM_ORACLE = 99800000;

    // Meta strategy that is allowed to mint/burn OUSD without changing collateral
    address public ousdMetaStrategy = address(0);

    // How much OUSD is currently minted by the strategy
    int256 public netOusdMintedForStrategy = 0;

    // How much net total OUSD is allowed to be minted by all strategies
    uint256 public netOusdMintForStrategyThreshold = 0;

    // Cheaper to read decimals locally than to call out each time
    mapping(address => uint256) internal decimalsCache; // TODO: Move to Asset struct

    /**
     * @dev set the implementation for the admin, this needs to be in a base class else we cannot set it
     * @param newImpl address of the implementation
     */
    function setAdminImpl(address newImpl) external onlyGovernor {
        require(
            Address.isContract(newImpl),
            "new implementation is not a contract"
        );
        bytes32 position = adminImplPosition;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(position, newImpl)
        }
    }

    /**
     * @dev Convert a quantity of a token into 1e18 fixed decimal "units"
     * in the underlying base (USD/ETH) used by the vault.
     * Price is not taken into account, only quantity.
     *
     * Examples of this conversion:
     *
     * - 1e18 DAI becomes 1e18 units (same decimals)
     * - 1e6 USDC becomes 1e18 units (decimal conversion)
     * - 1e18 rETH becomes 1.2e18 units (exchange rate conversion)
     *
     * @param _raw Quantity of asset
     * @param _asset Core Asset address
     * @return value 1e18 normalized quantity of units
     */
    function _toUnits(uint256 _raw, address _asset)
        internal
        view
        returns (uint256)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        if (conversion == UnitConversion.DECIMALS) {
            return _raw.scaleBy(18, _getDecimals(_asset));
        } else if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            return (_raw * exchangeRate) / 1e18;
        } else {
            require(false, "Unsupported conversion type");
        }
    }

    /**
     * @dev Returns asset's unit price accounting for different asset types
     *      and takes into account the context in which that price exists -
     *      - mint or redeem. 
     * 
     * Note: since we are returning the price of the unit and not the one of the
     * asset (see comment above how 1 rETH exchanges for 1.2 units) we need
     * to make the Oracle price adjustment as well since we are pricing the 
     * units and not the assets.
     * 
     * The price also snaps to a "full unit price" in case a mint or redeem 
     * action would be unfavourable to the protocol.
     * 
     */
    function _toUnitPrice(address _asset, bool isMint)
        internal
        view
        returns (uint256 price)
    {
        UnitConversion conversion = assets[_asset].unitConversion;
        price = IOracle(priceProvider).price(_asset) * 1e10;

        if (conversion == UnitConversion.GETEXCHANGERATE) {
            uint256 exchangeRate = IGetExchangeRateToken(_asset)
                .getExchangeRate();
            price = (price * 1e18) / exchangeRate;
        } else if (conversion != UnitConversion.DECIMALS){
            require(false, "Unsupported conversion type");
        }

        if (isMint) {
            /* Never price a normalized unit price for more than one
             * unit of OETH/OUSD when minting. 
             */
            if (price > 1e18) {
                price = 1e18;
            }
            require(price >= MINT_MINIMUM_ORACLE, "Asset price below peg");
        } else {
            /* Never give out more than 1 normalized unit amount of assets
             * for one unit of OETH/OUSD when redeeming.
             */
            if (price < 1e18) {
                price = 1e18;
            }
        }
    }

    function _getDecimals(address _asset) internal view returns (uint256) {
        uint256 decimals = decimalsCache[_asset];
        require(decimals > 0, "Decimals Not Cached");
        return decimals;
    }
}
