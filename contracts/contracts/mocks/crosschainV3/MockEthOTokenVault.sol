// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MockMintableBurnableOToken } from "./MockMintableBurnableOToken.sol";

/**
 * @title MockEthOTokenVault
 * @notice TEST-ONLY Ethereum-side OToken vault stand-in for the V3 RemoteV3Strategy tests.
 *
 *         Mirrors the OUSD VaultCore surface that Remote actually uses:
 *           - mint(amount): pulls bridgeAsset, mints OToken to caller (instant, 1:1).
 *           - redeem(amount, minAmount): burns OToken from caller, returns bridgeAsset (instant).
 *           - requestWithdrawal / claimWithdrawal: async queue used by the OETH path (PR 4).
 *
 *         The async queue stores requests by id with a configurable delay; tests can `advance`
 *         time or just bypass the delay.
 */
contract MockEthOTokenVault {
    using SafeERC20 for IERC20;

    address public immutable bridgeAsset;
    MockMintableBurnableOToken public immutable oToken;

    /// @notice Optional delay applied to async withdrawal claims (seconds). Default 0 = instant.
    uint256 public withdrawalClaimDelay;

    struct WithdrawalRequest {
        address owner;
        uint256 amount;
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
    }

    function setWithdrawalClaimDelay(uint256 _delay) external {
        withdrawalClaimDelay = _delay;
    }

    // --- Instant mint / redeem ---------------------------------------------

    function mint(uint256 _amount) external {
        IERC20(bridgeAsset).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        oToken.mint(msg.sender, _amount);
    }

    function redeem(uint256 _amount, uint256 _minAmount) external {
        require(_amount >= _minAmount, "MockEthVault: below min");
        oToken.burn(msg.sender, _amount);
        IERC20(bridgeAsset).safeTransfer(msg.sender, _amount);
    }

    // --- Async withdrawal queue (used by PR 4 / OETH path) -----------------

    function requestWithdrawal(uint256 _amount)
        external
        returns (uint256 id, uint256 queued)
    {
        // Burn the OToken upfront, mirror the real OETH vault flow.
        oToken.burn(msg.sender, _amount);
        id = nextRequestId++;
        withdrawalRequests[id] = WithdrawalRequest({
            owner: msg.sender,
            amount: _amount,
            claimableAt: block.timestamp + withdrawalClaimDelay,
            claimed: false
        });
        queued = _amount;
        emit WithdrawalRequested(id, msg.sender, _amount);
    }

    function claimWithdrawal(uint256 _id) external returns (uint256 amount) {
        WithdrawalRequest storage r = withdrawalRequests[_id];
        require(r.owner == msg.sender, "MockEthVault: not owner");
        require(!r.claimed, "MockEthVault: already claimed");
        require(block.timestamp >= r.claimableAt, "MockEthVault: queue delay");
        r.claimed = true;
        amount = r.amount;
        IERC20(bridgeAsset).safeTransfer(msg.sender, amount);
        emit WithdrawalClaimed(_id, msg.sender, amount);
    }
}
