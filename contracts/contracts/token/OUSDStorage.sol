pragma solidity 0.5.11;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import {
    Initializable
} from "@openzeppelin/upgrades/contracts/Initializable.sol";

import {
    InitializableERC20Detailed
} from "../utils/InitializableERC20Detailed.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { Governable } from "../governance/Governable.sol";

contract OUSDStorage is Initializable, InitializableERC20Detailed, Governable {
    using SafeMath for uint256;
    using StableMath for uint256;

    enum RebaseOptions { NotSet, OptOut, OptIn }

    uint256 public constant MAX_SUPPLY = ~uint128(0); // (2^128) - 1
    uint256 public _totalSupply;
    mapping(address => mapping(address => uint256)) public _allowances;
    address public vaultAddress = address(0);
    mapping(address => uint256) public _creditBalances; // change later
    uint256 public rebasingCredits;
    uint256 public rebasingCreditsPerToken;
    // Frozen address/credits are non rebasing (value is held in contracts which
    // do not receive yield unless they explicitly opt in)
    uint256 public nonRebasingSupply;
    mapping(address => uint256) public nonRebasingCreditsPerToken;
    mapping(address => RebaseOptions) public rebaseState;
    mapping(address => uint256) public isUpgraded;
}
