// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MockMintableBurnableOToken } from "./MockMintableBurnableOToken.sol";
import { IBasicToken } from "../../interfaces/IBasicToken.sol";
import { StableMath } from "../../utils/StableMath.sol";

/**
 * @title MockEthOTokenVault
 * @notice TEST-ONLY Ethereum-side OToken vault stand-in for the V3 RemoteWOTokenStrategy tests.
 *
 *         Mirrors the OUSD VaultCore surface Remote uses, INCLUDING the decimal scaling the
 *         real vault applies (`scaleBy(18, assetDecimals)` on mint; `scaleBy(assetDecimals, 18)`
 *         on the withdrawal queue), so a 6dp-asset / 18dp-oToken pair is exercised end-to-end.
 *         When the asset and OToken share decimals (e.g. WETH/OETH 18/18) every scale is the
 *         identity, matching production for the OETHb deployment.
 *           - mint(assetAmount): pulls bridgeAsset, mints scaled OToken to caller (instant, 1:1 value).
 *           - redeem(oTokenAmount, minAsset): burns OToken, returns scaled bridgeAsset (instant).
 *           - requestWithdrawal(oTokenAmount) / claimWithdrawal: async queue; the claim pays the
 *             asset-scaled amount after a configurable delay.
 */
contract MockEthOTokenVault {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    address public immutable bridgeAsset;
    MockMintableBurnableOToken public immutable oToken;
    uint8 public immutable assetDecimals;
    uint8 public immutable oTokenDecimals;

    /// @notice Optional delay applied to async withdrawal claims (seconds). Default 0 = instant.
    uint256 public withdrawalClaimDelay;

    struct WithdrawalRequest {
        address owner;
        uint256 amount; // asset-decimals payout
        uint256 claimableAt;
        bool claimed;
    }

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;
    uint256 public nextRequestId = 1;

    event WithdrawalRequested(
        uint256 indexed id,
        address indexed owner,
        uint256 amount
    );
    event WithdrawalClaimed(
        uint256 indexed id,
        address indexed owner,
        uint256 amount
    );

    constructor(address _bridgeAsset, MockMintableBurnableOToken _oToken) {
        bridgeAsset = _bridgeAsset;
        oToken = _oToken;
        assetDecimals = IBasicToken(_bridgeAsset).decimals();
        oTokenDecimals = _oToken.decimals();
    }

    function setWithdrawalClaimDelay(uint256 _delay) external {
        withdrawalClaimDelay = _delay;
    }

    /// @notice TEST-ONLY: seed the next requestId. Set to 0 to mimic a fresh vault whose
    ///         first-ever withdrawal returns requestId 0 (exercises the Remote offset-by-one).
    function setNextRequestId(uint256 _id) external {
        nextRequestId = _id;
    }

    // --- Instant mint / redeem ---------------------------------------------

    /// @param _amount Amount of bridgeAsset deposited (asset decimals). Mints scaled OToken.
    function mint(uint256 _amount) external {
        IERC20(bridgeAsset).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        oToken.mint(msg.sender, _amount.scaleBy(oTokenDecimals, assetDecimals));
    }

    /// @param _oTokenAmount OToken to burn (18dp). Returns the asset-scaled bridgeAsset.
    /// @dev TEST-ONLY: not exercised by the current suite; retained as a production-surface
    ///      mirror of the OToken vault's instant-redeem path Remote may use.
    function redeem(uint256 _oTokenAmount, uint256 _minAsset) external {
        uint256 assetAmount = _oTokenAmount.scaleBy(
            assetDecimals,
            oTokenDecimals
        );
        require(assetAmount >= _minAsset, "MockEthVault: below min");
        oToken.burn(msg.sender, _oTokenAmount);
        IERC20(bridgeAsset).safeTransfer(msg.sender, assetAmount);
    }

    // --- Async withdrawal queue (used by the OETH/OUSD withdraw path) ------

    /// @param _oTokenAmount OToken to burn (18dp). The queued payout is in asset decimals.
    function requestWithdrawal(uint256 _oTokenAmount)
        external
        returns (uint256 id, uint256 queued)
    {
        // Burn the OToken upfront, mirroring the real vault flow.
        oToken.burn(msg.sender, _oTokenAmount);
        uint256 assetAmount = _oTokenAmount.scaleBy(
            assetDecimals,
            oTokenDecimals
        );
        id = nextRequestId++;
        withdrawalRequests[id] = WithdrawalRequest({
            owner: msg.sender,
            amount: assetAmount,
            claimableAt: block.timestamp + withdrawalClaimDelay,
            claimed: false
        });
        queued = assetAmount;
        emit WithdrawalRequested(id, msg.sender, assetAmount);
    }

    function claimWithdrawal(uint256 _id) external returns (uint256 amount) {
        WithdrawalRequest storage r = withdrawalRequests[_id];
        require(r.owner == msg.sender, "MockEthVault: not owner");
        require(!r.claimed, "MockEthVault: already claimed");
        require(block.timestamp >= r.claimableAt, "MockEthVault: queue delay");
        r.claimed = true;
        amount = r.amount; // asset decimals
        IERC20(bridgeAsset).safeTransfer(msg.sender, amount);
        emit WithdrawalClaimed(_id, msg.sender, amount);
    }
}
