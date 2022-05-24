// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @dev Defines a contract that can be paused by the `Pauser` contract.
 */
abstract contract Pausable {
    event Paused(address account);
    event Unpaused(address account);

    modifier onlyPausers() {
        require(
            msg.sender == pauser() || _canPause(),
            "Caller cannot pause the contract"
        );
        _;
    }

    modifier onlyUnpausers() {
        require(
            msg.sender == pauser() || _canPause(),
            "Caller cannot pause the contract"
        );
        _;
    }

    /**
     * @dev Executes the pausing action.
     */
    function pause() external onlyPausers {
        emit Paused(msg.sender);
        _pause();
    }

    /**
     * @dev Executes the unpausing action.
     */
    function unpause() external onlyUnpausers {
        emit Unpaused(msg.sender);
        _unpause();
    }

    /**
     * @dev Returns the address of the pauser contract associated with this contract.
     * MUST be overriden in implementations to return the actual address.
     */
    function pauser() public view virtual returns (address);

    /**
     * @dev Executes the pausing action.
     * Returns true if the pause succeeded, false otherwise.
     * MUST be overriden in implementations to execute the actual pausing.
     * MUST revert on failed pausing.
     */
    function _pause() internal virtual;

    /**
     * @dev Executes the unpausing action.
     * Returns true if the action succeeded, false otherwise.
     * MUST be overriden in implementations to execute the actual unpausing.
     * MUST revert on failed unpausing.
     */
    function _unpause() internal virtual;

    /**
     * @dev Returns true if the sender can pause this contract.
     * MUST be overriden in implementations if accounts other than the pauser can pause the contract.
     */
    function _canPause() internal view virtual returns (bool) {
        return false;
    }

    /**
     * @dev Returns true if the sender can unpause this contract.
     * MUST be overriden in implementations if accounts other than the pauser can unpause the contract.
     */
    function _canUnpause() internal view virtual returns (bool) {
        return false;
    }
}
