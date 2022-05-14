// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { Pausable } from "./Pausable.sol";

contract Pauser is Initializable, Governable {
    event ExpiryDurationChanged(uint256 _newExpiry);
    event PausableChanged(address _newPausable);
    event StrategistChanged(address _newStrategist);
    event TempPaused(uint256 _expiry);
    event Paused();
    event Unpaused();
    event Whitelisted(address _account);
    event DeWhitelisted(address _account);

    uint8 public constant UNPAUSED = 0;
    uint8 public constant TEMP_PAUSE = 1;
    uint8 public constant PAUSED = 2;

    /**
     * @dev The current state of the contract.
     */
    uint8 public pauseState;

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
     * @dev Address of the strategist
     */
    address public strategistAddr = address(0);

    /**
     * @dev whitelist of addresses allowed to interact with the functionality exposed by this contract.
     */
    mapping(address => bool) whitelist;

    /**
     * @dev Expiry of the pause initiated by the account.
     * Map of account to the expiry of the temp-pause they have initiated.
     * Also used to invalidate a pauser to prevent abuse.
     */
    mapping(address => uint256) pauseExpiry;

    /**
     * @dev Verifies that the caller is a whitelisted account or the governor or strategist.
     */
    modifier onlyWhitelistedOrGovernorOrStrategist() {
        require(
            whitelist[msg.sender] || _isGovernorOrStrategist(),
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
    }

    function addToWhitelist(address _account)
        external
        onlyGovernorOrStrategist
    {
        whitelist[_account] = true;
        emit Whitelisted(_account);
    }

    function removeFromWhitelist(address _account)
        external
        onlyGovernorOrStrategist
    {
        whitelist[_account] = false;
        emit DeWhitelisted(_account);
    }

    /**
     * @dev Pauses the managed contract for the duration of `expiryDuration`
     * The pause action can be canceled by any user when the temp-pause expires.
     * The contract MUST be in an UNPAUSED state.
     * The function is one-time-use (The contract cannot be temp-paused by the same account twice).
     */
    function tempPause() external onlyWhitelistedOrGovernorOrStrategist {
        // Cannot pause if already paused
        require(pauseState == UNPAUSED, "Contract is not unpaused");

        if (!_isGovernorOrStrategist()) {
            // Cannot initiate a temp-pause if done before (one-time-use)
            require(
                pauseExpiry[msg.sender] == 0,
                "Caller has already initiated a temp pause"
            );
        }

        pauseState = TEMP_PAUSE;
        currentExpiry = block.timestamp + expiryDuration;
        pauseExpiry[msg.sender] = currentExpiry;
        emit TempPaused(currentExpiry);

        // Execute the pause action on the contract
        Pausable(pausable).pause();
    }

    /**
     * @dev Confirm a temporary pause on the contract
     * The contract MUST be in a TEMP_PAUSE state.
     * The confirmer MUST be different from the initiator.
     */
    function confirmPause() external onlyGovernorOrStrategist {
        // The contract MUST be in a TEMP_PAUSE state
        require(pauseState == TEMP_PAUSE, "The contract is not temp-paused");

        // currentExpiry MUST never be zero when pauseState = TEMP_PAUSE
        assert(currentExpiry != 0);

        // The confirmer MUST be different from the initiator
        require(
            pauseExpiry[msg.sender] != currentExpiry,
            "Cannot confirm self-initiated temp pause"
        );

        pauseState = PAUSED;
        currentExpiry = 0;
        emit Paused();
    }

    /**
     * @dev Cancel the temporary pause on the contract after expiry.
     * The contract MUST be in a TEMP_PAUSE state.
     */
    function cancelTempPause() external onlyWhitelistedOrGovernorOrStrategist {
        // Cannot cancel if not temp-paused
        require(pauseState == TEMP_PAUSE, "The contract is not temp-paused");

        // Cannot cancel before expiry
        require(
            block.timestamp > currentExpiry,
            "The current pause is not expired"
        );

        pauseState = UNPAUSED;
        currentExpiry = 0;
        emit Unpaused();

        // Execute the unpausing action on the contract
        Pausable(pausable).unpause();
    }

    /**
     * @dev Pauses the managed contract indefinitely
     */
    function pause() external onlyGovernorOrStrategist {
        // Cannot pause if already paused
        require(pauseState != PAUSED, "Contract is already paused");

        pauseState = PAUSED;
        currentExpiry = 0;
        emit Paused();

        // Execute the pause action on the contract
        Pausable(pausable).pause();
    }

    /**
     * @dev Unpauses the managed contract and resets expiry to 0
     */
    function unpause() external onlyGovernorOrStrategist {
        // Cannot unpause if already unpaused
        require(pauseState != UNPAUSED, "Contract is already unpaused");

        pauseState = UNPAUSED;
        currentExpiry = 0;
        emit Unpaused();

        // Execute the pause action on the contract
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
     * @dev Set the address of the strategist.
     * The caller MUST be the governor
     */
    function setStrategistAddr(address _strategistAddr) public onlyGovernor {
        strategistAddr = _strategistAddr;
        emit StrategistChanged(_strategistAddr);
    }

    /**
     * @dev Returns true if the caller is the governor or strategist. False otherwise.
     */
    function _isGovernorOrStrategist() private view returns (bool) {
        return msg.sender == strategistAddr || isGovernor();
    }
}
