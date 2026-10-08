// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Strategizable } from "../governance/Strategizable.sol";

interface IRebaseOptIn {
    function rebaseOptIn() external;
}

/**
 * @title Fee Splitter
 *
 * Standing recipient of the OToken fees the vaults mint on rebase (the
 * `trusteeAddress`). Splits each supported asset between the operations wallet
 * and the CoW harvester, which buys OGN for xOGN stakers.
 *
 * This replaces a multisig as the fee recipient. The point is that the routing
 * is fixed in code: whoever triggers `distribute()` cannot influence where the
 * funds go, only when they move.
 *
 * Permissions are split by blast radius rather than by convenience. The three
 * settings that decide where money goes — the operations wallet, the harvester
 * and the split itself — are Governor-only, because between them they can
 * redirect every fee the protocol earns. Asset bookkeeping is routine and sits
 * with the Strategist so it does not need a governance cycle.
 *
 * Deliberately not upgradeable. It holds value only between distributions, and
 * replacing it is a `setTrusteeAddress` proposal — the same governance cost as
 * an upgrade, without the storage-layout surface.
 */
contract FeeSplitter is Strategizable {
    using SafeERC20 for IERC20;

    /// @notice Upper bound on the operations share, as a sanity rail on governance itself.
    uint16 public constant MAX_OPERATIONS_BPS = 5000;

    /// @notice Share of each distribution sent to `operationsWallet`, in basis points.
    uint16 public operationsBps;

    /// @notice Recipient of the operations share.
    address public operationsWallet;

    /// @notice CoW harvester that buys OGN with the remainder.
    address public harvester;

    /// @notice Automation account allowed to call `distribute()`.
    address public operatorAddr;

    /// @notice Assets walked by the no-argument `distribute()`.
    address[] public supportedAssets;

    /// @notice Whether an asset is in `supportedAssets`.
    mapping(address => bool) public isSupported;

    /// @notice Per-asset dust floor. Balances below this are left to accumulate.
    mapping(address => uint256) public minDistribute;

    event Distributed(
        address indexed asset,
        uint256 opsAmount,
        uint256 buybackAmount
    );
    event OperationsBpsUpdated(uint16 bps);
    event OperationsWalletUpdated(address wallet);
    event HarvesterUpdated(address harvester);
    event OperatorUpdated(address operator);
    event AssetAdded(address indexed asset, uint256 minAmount);
    event AssetRemoved(address indexed asset);
    event MinDistributeUpdated(address indexed asset, uint256 minAmount);
    event Rescued(address indexed token, uint256 amount);

    /// @dev The deployer holds governorship so it can configure the splitter in
    ///      one transaction, then hands over with `transferGovernance`. The new
    ///      governor must `claimGovernance()` to complete it — that claim has to
    ///      be part of the governance proposal, or the splitter is left under the
    ///      deployer key.
    constructor() {
        _setGovernor(msg.sender);
    }

    /**
     * @dev Verifies the caller may trigger a distribution. Governor and
     *      Strategist are included so a distribution is still possible when the
     *      automation account is unavailable.
     */
    modifier onlyOperator() {
        require(
            msg.sender == operatorAddr ||
                msg.sender == strategistAddr ||
                isGovernor(),
            "Caller is not the Operator"
        );
        _;
    }

    // --- Distribution

    /// @notice Distribute every supported asset.
    function distribute() external onlyOperator {
        uint256 len = supportedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            _distribute(supportedAssets[i]);
        }
    }

    /// @notice Distribute a chosen subset of the supported assets.
    /// @param assets Assets to distribute. Each must be supported.
    function distribute(address[] calldata assets) external onlyOperator {
        uint256 len = assets.length;
        for (uint256 i = 0; i < len; ++i) {
            require(isSupported[assets[i]], "Asset not supported");
            _distribute(assets[i]);
        }
    }

    function _distribute(address asset) internal {
        (uint256 opsAmount, uint256 buybackAmount) = previewDistribute(asset);

        // Nothing to move: either the balance is zero or it is under the dust
        // floor. Return before emitting, so a skipped asset stays silent.
        if (opsAmount == 0 && buybackAmount == 0) {
            return;
        }

        if (opsAmount > 0) {
            IERC20(asset).safeTransfer(operationsWallet, opsAmount);
        }
        if (buybackAmount > 0) {
            IERC20(asset).safeTransfer(harvester, buybackAmount);
        }

        emit Distributed(asset, opsAmount, buybackAmount);
    }

    // --- Views

    /// @notice All assets walked by the no-argument `distribute()`.
    function getSupportedAssets() external view returns (address[] memory) {
        return supportedAssets;
    }

    /// @notice Amounts a distribution would move right now.
    /// @dev Returns (0, 0) when the balance is under the asset's dust floor.
    ///      `public` rather than `external` because `_distribute` calls it: the
    ///      split is defined in exactly one place, so the preview and the
    ///      transfer can never disagree.
    function previewDistribute(address asset)
        public
        view
        returns (uint256 opsAmount, uint256 buybackAmount)
    {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance < minDistribute[asset] || balance == 0) {
            return (0, 0);
        }
        // The ops share floors, so the rounding remainder goes to the buyback.
        opsAmount = (balance * operationsBps) / 1e4;
        // Derived from the same snapshot rather than a second balanceOf(): these
        // are rebasing tokens, and the balance can move between the two reads.
        buybackAmount = balance - opsAmount;
    }

    // --- Governor only
    //
    // These decide where the money goes. Governor-only because between them they
    // can redirect 100% of protocol fees.

    /// @notice Set the operations share, in basis points.
    function setOperationsBps(uint16 _bps) external onlyGovernor {
        require(_bps <= MAX_OPERATIONS_BPS, "Operations bps too high");
        operationsBps = _bps;
        emit OperationsBpsUpdated(_bps);
    }

    /// @notice Set the recipient of the operations share.
    function setOperationsWallet(address _wallet) external onlyGovernor {
        require(_wallet != address(0), "Invalid operations wallet");
        operationsWallet = _wallet;
        emit OperationsWalletUpdated(_wallet);
    }

    /// @notice Set the CoW harvester that receives the buyback share.
    function setHarvester(address _harvester) external onlyGovernor {
        require(_harvester != address(0), "Invalid harvester");
        harvester = _harvester;
        emit HarvesterUpdated(_harvester);
    }

    /// @notice Recover a token that is not part of the fee flow.
    /// @dev Refuses supported assets. This guards against operator error, not
    ///      against the Governor: a Governor set on redirecting fees can call
    ///      `removeAsset` first, and already has `setOperationsWallet` anyway.
    ///      What it does buy is that a rescue cannot touch fee balances by
    ///      accident, which is the realistic failure.
    function rescue(address _token, uint256 _amount) external onlyGovernor {
        require(!isSupported[_token], "Cannot rescue a supported asset");
        IERC20(_token).safeTransfer(governor(), _amount);
        emit Rescued(_token, _amount);
    }

    // --- Governor or Strategist
    //
    // Routine bookkeeping. None of these can move funds off the configured routes.

    /// @notice Add an asset to the distribution set.
    function addAsset(address _asset, uint256 _minAmount)
        external
        onlyGovernorOrStrategist
    {
        require(_asset != address(0), "Invalid asset");
        require(!isSupported[_asset], "Asset already supported");
        isSupported[_asset] = true;
        minDistribute[_asset] = _minAmount;
        supportedAssets.push(_asset);
        emit AssetAdded(_asset, _minAmount);
    }

    /// @notice Remove an asset from the distribution set.
    /// @dev Any balance already held stays put and becomes rescuable.
    function removeAsset(address _asset) external onlyGovernorOrStrategist {
        require(isSupported[_asset], "Asset not supported");

        uint256 len = supportedAssets.length;
        for (uint256 i = 0; i < len; ++i) {
            if (supportedAssets[i] == _asset) {
                supportedAssets[i] = supportedAssets[len - 1];
                supportedAssets.pop();
                break;
            }
        }

        isSupported[_asset] = false;
        minDistribute[_asset] = 0;
        emit AssetRemoved(_asset);
    }

    /// @notice Set an asset's dust floor.
    /// @dev Keep this at or above the harvester's `minSellAmount` for the asset,
    ///      otherwise a distribution can forward an amount the harvester is not
    ///      allowed to sell, and it sits there until the next one.
    function setMinDistribute(address _asset, uint256 _minAmount)
        external
        onlyGovernorOrStrategist
    {
        require(isSupported[_asset], "Asset not supported");
        minDistribute[_asset] = _minAmount;
        emit MinDistributeUpdated(_asset, _minAmount);
    }

    /// @notice Set the automation account allowed to call `distribute()`.
    function setOperatorAddr(address _operator)
        external
        onlyGovernorOrStrategist
    {
        operatorAddr = _operator;
        emit OperatorUpdated(_operator);
    }

    /// @notice Opt this contract into receiving yield on a rebasing OToken.
    /// @dev OTokens mark contracts as non-rebasing on first receipt, so without
    ///      this the fees waiting here would stop earning. Cheapest to call
    ///      before the first fee arrives, though it also works afterwards.
    function optIntoRebase(address _oToken) external onlyGovernorOrStrategist {
        IRebaseOptIn(_oToken).rebaseOptIn();
    }
}
