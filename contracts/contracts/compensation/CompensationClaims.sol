pragma solidity 0.5.11;

import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Governable } from "../governance/Governable.sol";

contract CompensationClaims is Governable {
    address public adjuster;
    address public token;
    uint256 public end;
    uint256 public totalClaims;
    mapping(address => uint256) claims;
    bool public isAdjusterLocked;

    using SafeMath for uint256;

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

    constructor(address _token, address _adjuster) public onlyGovernor {
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

    function claim(address _recipient) external onlyInClaimPeriod nonReentrant {
        uint256 amount = claims[_recipient];
        require(amount > 0, "Amount must be greater than 0");
        claims[_recipient] = 0;
        totalClaims = totalClaims.sub(amount);
        SafeERC20.safeTransfer(IERC20(token), _recipient, amount);
    }

    function setClaims(
        address[] calldata _addresses,
        uint256[] calldata _amounts
    ) external notInClaimPeriod onlyUnlockedAdjuster {
        require(
            _addresses.length == _amounts.length,
            "Addresses and amounts must match"
        );
        uint256 len = _addresses.length;
        for (uint256 i; i < len; i++) {
            uint256 oldAmount = claims[_addresses[i]];
            uint256 newAmount = _amounts[i];
            claims[_addresses[i]] = newAmount;
            totalClaims = totalClaims.add(newAmount).sub(oldAmount);
        }
    }

    function lockAdjuster() external onlyGovernor notInClaimPeriod {
        _lockAdjuster();
    }

    function _lockAdjuster() internal {
        isAdjusterLocked = true;
    }

    function unlockAdjuster() external onlyGovernor notInClaimPeriod {
        isAdjusterLocked = false;
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
    }

    function collect(address _coin)
        external
        onlyGovernor
        notInClaimPeriod
        nonReentrant
    {
        uint256 amount = IERC20(_coin).balanceOf(address(this));
        SafeERC20.safeTransfer(IERC20(_coin), address(governor()), amount);
    }
}

interface IERC20Decimals {
    function decimals() external view returns (uint8);
}
