// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Pausable } from "./Pausable.sol";
import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";

contract Pauser is Initializable, AccessControl, Governable {
    event ExpiryDurationChanged(uint256 _newExpiry);
    event PausableChanged(address _newPausable);
    event TempPaused(address _sender, uint256 _expiry);

    enum PauseState {
        UNPAUSED,
        TEMP_PAUSED,
        PAUSED
    }

    bytes32 public constant STRATEGIST_ROLE = keccak256("STRATEGIST_ROLE");
    bytes32 public constant TEMP_PAUSER_ROLE = keccak256("TEMP_PAUSER_ROLE");

    /**
     * @dev The current state of the contract.
     */
    PauseState public pauseState;

    /**
     * @dev The duration of a temp-pause in seconds.
     */
    uint256 public expiryDuration;

    /**
     * @dev The expiry timestamp of the current temp-pause.
     * If unpaused or confirmed, the expiry timestamp should be zero (0).
     */
    uint256 public currentExpiry;

    /**
     * @dev The address of the managed contract.
     */
    address public pausable;

    /**
     * @dev Verifies that the caller is a whitelisted account or the governor or strategist.
     */
    modifier onlyWhitelistedOrGovernorOrStrategist() {
        require(
            hasRole(TEMP_PAUSER_ROLE, msg.sender) || _isGovernorOrStrategist(),
            "Caller is not whitelisted and is not the Strategist or Governor"
        );
        _;
    }

    modifier onlyGovernorOrStrategist() {
        require(
            _isGovernorOrStrategist(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    function initialize(address _pausable, uint256 _expiryDuration)
        external
        onlyGovernor
        initializer
    {
        setPausable(_pausable);
        setExpiryDuration(_expiryDuration);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function addToWhitelist(address _account)
        external
        onlyGovernorOrStrategist
    {
        _grantRole(TEMP_PAUSER_ROLE, _account);
    }

    function removeFromWhitelist(address _account)
        external
        onlyGovernorOrStrategist
    {
        _revokeRole(TEMP_PAUSER_ROLE, _account);
    }

    /**
     * @dev Pauses the managed contract indefinitely
     */
    function pause() external onlyWhitelistedOrGovernorOrStrategist {
        // Cannot pause if already paused
        require(pauseState != PauseState.PAUSED, "Contract is already paused");

        if (_isGovernorOrStrategist()) {
            pauseState = PauseState.PAUSED;
            currentExpiry = 0;
        } else {
            pauseState = PauseState.TEMP_PAUSED;
            currentExpiry = block.timestamp + expiryDuration;
            _revokeRole(TEMP_PAUSER_ROLE, msg.sender);
            emit TempPaused(msg.sender, currentExpiry);
        }

        // Execute the pause action on the contract
        Pausable(pausable).pause();
    }

    /**
     * @dev Unpauses the managed contract and resets expiry to 0
     */
    function unpause() external {
        // Cannot unpause if already unpaused
        require(
            pauseState != PauseState.UNPAUSED,
            "Contract is already unpaused"
        );

        // Normal users can unpause when the contract has expired
        if (!_isGovernorOrStrategist()) {
            require(
                pauseState == PauseState.TEMP_PAUSED &&
                    block.timestamp > currentExpiry,
                "The current pause is not expired"
            );
        }

        pauseState = PauseState.UNPAUSED;
        currentExpiry = 0;
        // Execute the unpause action on the contract
        Pausable(pausable).unpause();
    }

    /**
     * @dev Set the duration (in seconds) of a temp-pause expiry
     * The caller MUST be the governor
     */
    function setExpiryDuration(uint256 _expiryDuration) public onlyGovernor {
        expiryDuration = _expiryDuration;
        emit ExpiryDurationChanged(_expiryDuration);
    }

    /**
     * @dev Set the address of the managed `Pausable` contract.
     * The caller MUST be the governor
     */
    function setPausable(address _pausable) public onlyGovernor {
        pausable = _pausable;
        emit PausableChanged(_pausable);
    }

    /**
     * @dev Add the address to the strategist role
     * The caller MUST be the governor
     */
    function addStrategist(address _addr) public onlyGovernor {
        _grantRole(STRATEGIST_ROLE, _addr);
    }

    /**
     * @dev Add the address to the strategist role
     * The caller MUST be the governor
     */
    function removeStrategist(address _addr) public onlyGovernor {
        _revokeRole(STRATEGIST_ROLE, _addr);
    }

    /**
     * @dev Returns true if the caller is the governor or strategist. False otherwise.
     */
    function _isGovernorOrStrategist() private view returns (bool) {
        return hasRole(STRATEGIST_ROLE, msg.sender) || isGovernor();
    }
}
