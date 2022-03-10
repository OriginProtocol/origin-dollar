// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/utils/math/SafeMath.sol";

import { Initializable } from "../utils/Initializable.sol";
import { Governable } from "../governance/Governable.sol";

/**
 * @title Compensation Claims
 * @author Origin Protocol Inc
 * @dev Airdrop for ERC20 tokens.
 *
 *   Provides a coin airdrop with a verification period in which everyone
 *   can check that all claims are correct before any actual funds are moved
 *   to the contract.
 *
 *      - Users can claim funds during the claim period.
 *
 *      - The adjuster can set the amount of each user's claim,
 *         but only when unlocked, and not during the claim period.
 *
 *      - The governor can unlock and lock the adjuster, outside the claim period.
 *      - The governor can start the claim period, if it's not started.
 *      - The governor can collect any remaining funds after the claim period is over.
 *
 *  Intended use sequence:
 *
 *   1. Governor unlocks the adjuster
 *   2. Adjuster uploads claims
 *   3. Governor locks the adjuster
 *   4. Everyone verifies that the claim amounts and totals are correct
 *   5. Payout funds are moved to the contract
 *   6. The claim period starts
 *   7. Users claim funds
 *   8. The claim period ends
 *   9. Governor can collect any remaing funds
 *
 */
contract CompensationClaims is Governable {
    address public adjuster;
    address public token;
    uint256 public end;
    uint256 public totalClaims;
    mapping(address => uint256) claims;
    bool public isAdjusterLocked;

    using SafeMath for uint256;

    event Claim(address indexed recipient, uint256 amount);
    event ClaimSet(address indexed recipient, uint256 amount);
    event Start(uint256 end);
    event Lock();
    event Unlock();
    event Collect(address indexed coin, uint256 amount);

    constructor(address _token, address _adjuster) onlyGovernor {
        token = _token;
        adjuster = _adjuster;
        isAdjusterLocked = true;
    }

    function balanceOf(address _account) external view returns (uint256) {
        return claims[_account];
    }

    function decimals() external view returns (uint8) {
        return IERC20Decimals(token).decimals();
    }

    /* -- User -- */

    function claim(address _recipient) external onlyInClaimPeriod nonReentrant {
        uint256 amount = claims[_recipient];
        require(amount > 0, "Amount must be greater than 0");
        claims[_recipient] = 0;
        totalClaims = totalClaims.sub(amount);
        SafeERC20.safeTransfer(IERC20(token), _recipient, amount);
        emit Claim(_recipient, amount);
    }

    /* -- Adjustor -- */

    function setClaims(
        address[] calldata _addresses,
        uint256[] calldata _amounts
    ) external notInClaimPeriod onlyUnlockedAdjuster {
        require(
            _addresses.length == _amounts.length,
            "Addresses and amounts must match"
        );
        uint256 len = _addresses.length;
        for (uint256 i = 0; i < len; i++) {
            address recipient = _addresses[i];
            uint256 newAmount = _amounts[i];
            uint256 oldAmount = claims[recipient];
            claims[recipient] = newAmount;
            totalClaims = totalClaims.add(newAmount).sub(oldAmount);
            emit ClaimSet(recipient, newAmount);
        }
    }

    /* -- Governor -- */

    function lockAdjuster() external onlyGovernor notInClaimPeriod {
        _lockAdjuster();
    }

    function _lockAdjuster() internal {
        isAdjusterLocked = true;
        emit Lock();
    }

    function unlockAdjuster() external onlyGovernor notInClaimPeriod {
        isAdjusterLocked = false;
        emit Unlock();
    }

    function start(uint256 _seconds)
        external
        onlyGovernor
        notInClaimPeriod
        nonReentrant
    {
        require(totalClaims > 0, "No claims");
        uint256 funding = IERC20(token).balanceOf(address(this));
        require(funding >= totalClaims, "Insufficient funds for all claims");
        _lockAdjuster();
        end = block.timestamp.add(_seconds);
        require(end.sub(block.timestamp) < 31622400, "Duration too long"); // 31622400 = 366*24*60*60
        emit Start(end);
    }

    function collect(address _coin)
        external
        onlyGovernor
        notInClaimPeriod
        nonReentrant
    {
        uint256 amount = IERC20(_coin).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(_coin), address(governor()), amount);
        emit Collect(_coin, amount);
    }

    /* -- modifiers -- */

    modifier onlyInClaimPeriod() {
        require(block.timestamp <= end, "Should be in claim period");
        _;
    }

    modifier notInClaimPeriod() {
        require(block.timestamp > end, "Should not be in claim period");
        _;
    }

    modifier onlyUnlockedAdjuster() {
        require(isAdjusterLocked == false, "Adjuster must be unlocked");
        require(msg.sender == adjuster, "Must be adjuster");
        _;
    }
}

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}
