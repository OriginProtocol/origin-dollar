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
        // Cheaper to read decimals locally than to call out each time
        uint256 decimalsCache;
    }

    // slither-disable-next-line uninitialized-state
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
    // slither-disable-next-line uninitialized-state
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

    uint256 constant MINT_MINIMUM_UNIT_PRICE = 0.998e18;

    // Meta strategy that is allowed to mint/burn OUSD without changing collateral
    address public ousdMetaStrategy = address(0);

    // How much OUSD is currently minted by the strategy
    int256 public netOusdMintedForStrategy = 0;

    // How much net total OUSD is allowed to be minted by all strategies
    uint256 public netOusdMintForStrategyThreshold = 0;

    uint256 constant MIN_UNIT_PRICE_DRIFT = 0.7e18;
    uint256 constant MAX_UNIT_PRICE_DRIFT = 1.3e18;

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
}
