pragma solidity 0.5.11;

/**
 * @title OUSD VaultStorage Contract
 * @notice The VaultStorage contract defines the storage for the Vault contracts
 * @author Origin Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { Governable } from "../governance/Governable.sol";
import { OUSD } from "../token/OUSD.sol";
import "../utils/Helpers.sol";
import { StableMath } from "../utils/StableMath.sol";

contract VaultStorage is Initializable, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeMath for int256;
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetDefaultStrategyUpdated(address _asset, address _strategy);
    event StrategyApproved(address _addr);
    event StrategyRemoved(address _addr);
    event Mint(address _addr, uint256 _value);
    event Redeem(address _addr, uint256 _value);
    event DepositsPaused();
    event DepositsUnpaused();
    event RebasePaused();
    event RebaseUnpaused();
    event VaultBufferUpdated(uint256 _vaultBuffer);
    event RedeemFeeUpdated(uint256 _redeemFeeBps);
    event PriceProviderUpdated(address _priceProvider);
    event AllocateThresholdUpdated(uint256 _threshold);
    event RebaseThresholdUpdated(uint256 _threshold);
    event UniswapUpdated(address _address);
    event StrategistUpdated(address _address);

    // Assets supported by the Vault, i.e. Stablecoins
    struct Asset {
        bool isSupported;
    }
    mapping(address => Asset) assets;
    address[] allAssets;

    // Strategies approved for use by the Vault
    struct Strategy {
        bool isSupported;
        uint256 _deprecated; // Deprecated storage slot
    }
    mapping(address => Strategy) strategies;
    address[] allStrategies;

    // Address of the Oracle price provider contract
    address public priceProvider;
    // Pausing bools
    bool public rebasePaused = false;
    bool public depositPaused = true;
    // Redemption fee in basis points
    uint256 public redeemFeeBps;
    // Buffer of assets to keep in Vault to handle (most) withdrawals
    uint256 public vaultBuffer;
    // Mints over this amount automatically allocate funds. 18 decimals.
    uint256 public autoAllocateThreshold;
    // Mints over this amount automatically rebase. 18 decimals.
    uint256 public rebaseThreshold;

    OUSD oUSD;

    //keccak256("OUSD.vault.governor.admin.impl");
    bytes32 constant adminImplPosition = 0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    // Address of the contract responsible for post rebase syncs with AMMs
    address private _deprecated_rebaseHooksAddr = address(0);

    // Address of Uniswap
    address public uniswapAddr = address(0);

    // Address of the Strategist
    address public strategistAddr = address(0);

    // Mapping of asset address to the Strategy that they should automatically
    // be allocated to
    mapping(address => address) public assetDefaultStrategies;

    /**
     * @dev set the implementation for the admin, this needs to be in a base class else we cannot set it
     * @param newImpl address pf the implementation
     */
    function setAdminImpl(address newImpl) external onlyGovernor {
        bytes32 position = adminImplPosition;
        assembly {
            sstore(position, newImpl)
        }
    }
}
