pragma solidity 0.5.11;

import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Governable } from "../governance/Governable.sol";

contract CompensationClaims is Initializable, Governable {
    address adjuster;
    address token;

    modifier onlyInClaimPeriod() {
        require(false);
        _;
    }
    modifier notInClaimPeriod() {
        require(false);
        _;
    }
    modifier onlyUnlockedAdjuster() {
        require(false);
        _;
    }

    function initialize(address _adjuster, address _token)
        external
        onlyGovernor
        initializer
    {
        token = token;
        adjuster = adjuster;
    }

    function balanceOf() external view returns (uint256) {
        return 0;
    }

    function totalClaims() external view returns (uint256) {
        return 0;
    }

    function claim() external onlyInClaimPeriod {}

    function setClaims(address[] calldata _users, uint256[] calldata _amounts)
        external
        onlyUnlockedAdjuster
        notInClaimPeriod
    {}

    function lockAdjuster() external onlyGovernor notInClaimPeriod {}

    function unlockAdjuster() external onlyGovernor notInClaimPeriod {}

    function start(uint256 _endTime) external onlyGovernor notInClaimPeriod {}

    function collect(address _coin) external onlyGovernor notInClaimPeriod {}
}
