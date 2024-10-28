// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OToken VaultStorage contract
 * @notice The VaultStorage contract defines the storage for the Vault contracts
 * @author Origin Protocol Inc
 */

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Address } from "@openzeppelin/contracts/utils/Address.sol";

import { IStrategy } from "../interfaces/IStrategy.sol";
import { Governable } from "../governance/Governable.sol";
import { OUSD } from "../token/OUSD.sol";
import { Initializable } from "../utils/Initializable.sol";
import "../utils/Helpers.sol";

contract VaultStorage is Initializable, Governable {
    using SafeERC20 for IERC20;

    event AssetSupported(address _asset);
    event AssetRemoved(address _asset);
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
    event SwapperChanged(address _address);
    event SwapAllowedUndervalueChanged(uint256 _basis);
    event SwapSlippageChanged(address _asset, uint256 _basis);
    event Swapped(
        address indexed _fromAsset,
        address indexed _toAsset,
        uint256 _fromAssetAmount,
        uint256 _toAssetAmount
    );
    event StrategyAddedToMintWhitelist(address indexed strategy);
    event StrategyRemovedFromMintWhitelist(address indexed strategy);
    event DripperChanged(address indexed _dripper);
    event WithdrawalRequested(
        address indexed _withdrawer,
        uint256 indexed _requestId,
        uint256 _amount,
        uint256 _queued
    );
    event WithdrawalClaimed(
        address indexed _withdrawer,
        uint256 indexed _requestId,
        uint256 _amount
    );
    event WithdrawalClaimable(uint256 _claimable, uint256 _newClaimable);
    event WithdrawalClaimDelayUpdated(uint256 _newDelay);

    // Assets supported by the Vault, i.e. Stablecoins
    enum UnitConversion {
        DECIMALS,
        GETEXCHANGERATE
    }
    // Changed to fit into a single storage slot so the decimals needs to be recached
    struct Asset {
        // Note: OETHVaultCore doesn't use `isSupported` when minting,
        // redeeming or checking balance of assets.
        bool isSupported;
        UnitConversion unitConversion;
        uint8 decimals;
        // Max allowed slippage from the Oracle price when swapping collateral assets in basis points.
        // For example 40 == 0.4% slippage
        uint16 allowedOracleSlippageBps;
    }

    /// @dev mapping of supported vault assets to their configuration
    // slither-disable-next-line uninitialized-state
    mapping(address => Asset) internal assets;
    /// @dev list of all assets supported by the vault.
    // slither-disable-next-line uninitialized-state
    address[] internal allAssets;

    // Strategies approved for use by the Vault
    struct Strategy {
        bool isSupported;
        uint256 _deprecated; // Deprecated storage slot
    }
    /// @dev mapping of strategy contracts to their configuration
    // slither-disable-next-line uninitialized-state
    mapping(address => Strategy) internal strategies;
    /// @dev list of all vault strategies
    address[] internal allStrategies;

    /// @notice Address of the Oracle price provider contract
    // slither-disable-next-line uninitialized-state
    address public priceProvider;
    /// @notice pause rebasing if true
    bool public rebasePaused = false;
    /// @notice pause operations that change the OToken supply.
    /// eg mint, redeem, allocate, mint/burn for strategy
    bool public capitalPaused = true;
    /// @notice Redemption fee in basis points. eg 50 = 0.5%
    uint256 public redeemFeeBps;
    /// @notice Percentage of assets to keep in Vault to handle (most) withdrawals. 100% = 1e18.
    uint256 public vaultBuffer;
    /// @notice OToken mints over this amount automatically allocate funds. 18 decimals.
    uint256 public autoAllocateThreshold;
    /// @notice OToken mints over this amount automatically rebase. 18 decimals.
    uint256 public rebaseThreshold;

    /// @dev Address of the OToken token. eg OUSD or OETH.
    // slither-disable-next-line uninitialized-state
    OUSD internal oUSD;

    //keccak256("OUSD.vault.governor.admin.impl");
    bytes32 constant adminImplPosition =
        0xa2bd3d3cf188a41358c8b401076eb59066b09dec5775650c0de4c55187d17bd9;

    // Address of the contract responsible for post rebase syncs with AMMs
    address private _deprecated_rebaseHooksAddr = address(0);

    // Deprecated: Address of Uniswap
    // slither-disable-next-line constable-states
    address private _deprecated_uniswapAddr = address(0);

    /// @notice Address of the Strategist
    address public strategistAddr = address(0);

    /// @notice Mapping of asset address to the Strategy that they should automatically
    // be allocated to
    // slither-disable-next-line uninitialized-state
    mapping(address => address) public assetDefaultStrategies;

    /// @notice Max difference between total supply and total value of assets. 18 decimals.
    // slither-disable-next-line uninitialized-state
    uint256 public maxSupplyDiff;

    /// @notice Trustee contract that can collect a percentage of yield
    address public trusteeAddress;

    /// @notice Amount of yield collected in basis points. eg 2000 = 20%
    uint256 public trusteeFeeBps;

    /// @dev Deprecated: Tokens that should be swapped for stablecoins
    address[] private _deprecated_swapTokens;

    uint256 constant MINT_MINIMUM_UNIT_PRICE = 0.998e18;

    /// @notice Metapool strategy that is allowed to mint/burn OTokens without changing collateral

    // slither-disable-start constable-states
    // slither-disable-next-line uninitialized-state
    address public ousdMetaStrategy;

    /// @notice How much OTokens are currently minted by the strategy
    // slither-disable-next-line uninitialized-state
    int256 public netOusdMintedForStrategy;

    /// @notice How much net total OTokens are allowed to be minted by all strategies
    // slither-disable-next-line uninitialized-state
    uint256 public netOusdMintForStrategyThreshold;

    // slither-disable-end constable-states

    uint256 constant MIN_UNIT_PRICE_DRIFT = 0.7e18;
    uint256 constant MAX_UNIT_PRICE_DRIFT = 1.3e18;

    /// @notice Collateral swap configuration.
    /// @dev is packed into a single storage slot to save gas.
    struct SwapConfig {
        // Contract that swaps the vault's collateral assets
        address swapper;
        // Max allowed percentage the total value can drop below the total supply in basis points.
        // For example 100 == 1%
        uint16 allowedUndervalueBps;
    }
    SwapConfig internal swapConfig = SwapConfig(address(0), 0);

    // List of strategies that can mint oTokens directly
    // Used in OETHBaseVaultCore
    // slither-disable-next-line uninitialized-state
    mapping(address => bool) public isMintWhitelistedStrategy;

    /// @notice Address of the Dripper contract that streams harvested rewards to the Vault
    /// @dev The vault is proxied so needs to be set with setDripper against the proxy contract.
    // slither-disable-start constable-states
    // slither-disable-next-line uninitialized-state
    address public dripper;
    // slither-disable-end constable-states

    /// Withdrawal Queue Storage /////

    struct WithdrawalQueueMetadata {
        // cumulative total of all withdrawal requests included the ones that have already been claimed
        uint128 queued;
        // cumulative total of all the requests that can be claimed including the ones that have already been claimed
        uint128 claimable;
        // total of all the requests that have been claimed
        uint128 claimed;
        // index of the next withdrawal request starting at 0
        uint128 nextWithdrawalIndex;
    }

    /// @notice Global metadata for the withdrawal queue including:
    /// queued - cumulative total of all withdrawal requests included the ones that have already been claimed
    /// claimable - cumulative total of all the requests that can be claimed including the ones already claimed
    /// claimed - total of all the requests that have been claimed
    /// nextWithdrawalIndex - index of the next withdrawal request starting at 0
    // slither-disable-next-line uninitialized-state
    WithdrawalQueueMetadata public withdrawalQueueMetadata;

    struct WithdrawalRequest {
        address withdrawer;
        bool claimed;
        uint40 timestamp; // timestamp of the withdrawal request
        // Amount of oTokens to redeem. eg OETH
        uint128 amount;
        // cumulative total of all withdrawal requests including this one.
        // this request can be claimed when this queued amount is less than or equal to the queue's claimable amount.
        uint128 queued;
    }

    /// @notice Mapping of withdrawal request indices to the user withdrawal request data
    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    /// @notice Sets a minimum delay that is required to elapse between
    ///     requesting async withdrawals and claiming the request.
    ///     When set to 0 async withdrawals are disabled.
    // slither-disable-start constable-states
    // slither-disable-next-line uninitialized-state
    uint256 public withdrawalClaimDelay;
    // slither-disable-end constable-states

    // For future use
    uint256[44] private __gap;

    /**
     * @notice set the implementation for the admin, this needs to be in a base class else we cannot set it
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
