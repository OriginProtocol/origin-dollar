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
     * 
     */
    function oraclePrice(address asset) internal view returns (uint256 price) {
        if (
            // frxETH
            asset == address(0x5E8422345238F34275888049021821E8E08CAa1f)
        ) {
            price = 1e18;
        } else if (
            // WETH/ETH
            asset == address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2)
        ) {
            price = 1e18;
        } else if (
            // rETH/ETH
            asset == address(0xae78736Cd615f374D3085123A210448E74Fc6393)
        ) {
            // feed
            // 0xF3272CAfe65b190e76caAF483db13424a3e23dD2
        } else if (
            // cbETH/ETH
            asset == address(0xBe9895146f7AF43049ca1c1AE358B0541Ea49704)
        ) {
            // feed
            // 0xF017fcB346A1885194689bA23Eff2fE6fA5C483b
        } else if (
            // stETH/ETH
            asset == address(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84)
        ) {
            // feed
            // 0x86392dC19c0b719886221c78AB11eb8Cf5c52812
        }
        //price = IOracle(priceProvider).price(_asset) * 1e10;

    }
}
