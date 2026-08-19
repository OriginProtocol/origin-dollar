// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";

import { IVault } from "../interfaces/IVault.sol";

/**
 * @title PauseSafeModule
 * @notice Gnosis Safe module that lets a threat-detection operator pause OToken
 *         vaults without waiting for multisig signatures to be gathered.
 *
 * @dev The Safe hosting this module is the Guardian multisig, which is already
 *      authorized to pause every supported target: it is the vaults'
 *      `strategistAddr`, and the ARMs' `guardian`. This module does not widen
 *      that authority — it only lets a keyed operator exercise it without
 *      collecting signatures.
 *
 *      Safety properties, in order of importance:
 *
 *      1. This module can never unpause. The only three selectors it can encode
 *         are `pauseCapital()`, `pauseRebase()` and `pause()`, all compiled in
 *         below. That is a property of the bytecode, not of configuration —
 *         there is no allow-list entry or role that could turn an unpause into
 *         a legal call. Unpausing requires the Admin multisig acting directly
 *         on the target.
 *      2. Targets are allow-listed by the Safe, so a compromised operator key
 *         cannot aim a pause at an arbitrary contract.
 *      3. Pause failures revert. A pause that silently did not land is worse
 *         than a loud failure, because the detection service would treat the
 *         protocol as contained when it is not. Targets are checked for code at
 *         allow-list time for the same reason: a Safe module call to a codeless
 *         address reports success, so an EOA target would pause nothing while
 *         looking like it had.
 *
 *      The Safe must call `enableModule(address(this))` before this module can
 *      do anything at all.
 */
contract PauseSafeModule is AbstractSafeModule {
    /// @dev `bytes4(keccak256("pause()"))`. Hardcoded rather than taken from a
    ///      project interface because the target lives in another repo: this is
    ///      `AbstractARM.pause()`, guarded by `onlyPauser`, which includes the
    ///      Guardian Safe hosting this module.
    bytes4 internal constant PAUSE_SELECTOR = 0x8456cb59;

    /// @notice Contracts this module is permitted to pause.
    mapping(address => bool) public isPausableTarget;

    event TargetAllowed(address indexed target);
    event TargetRevoked(address indexed target);
    event CapitalPauseExecuted(address indexed target);
    event RebasePauseExecuted(address indexed target);
    event PauseExecuted(address indexed target);

    /**
     * @param _safeContract Address of the Gnosis Safe (Guardian multisig).
     * @param _operators    Addresses allowed to trigger a pause. Typically the
     *                      threat-detection keeper plus an in-house backup.
     * @param _targets      Contracts this module may pause.
     */
    constructor(
        address _safeContract,
        address[] memory _operators,
        address[] memory _targets
    ) AbstractSafeModule(_safeContract) {
        for (uint256 i = 0; i < _operators.length; i++) {
            require(_operators[i] != address(0), "Invalid operator");
            _grantRole(OPERATOR_ROLE, _operators[i]);
        }

        for (uint256 i = 0; i < _targets.length; i++) {
            _allowTarget(_targets[i]);
        }
    }

    /**
     * @notice Halt mint and redeem on an allow-listed vault.
     * @param _target Vault to pause.
     */
    function pauseCapital(address _target) external onlyOperator {
        _execPause(_target, IVault.pauseCapital.selector);
        emit CapitalPauseExecuted(_target);
    }

    /**
     * @notice Halt rebasing on an allow-listed vault.
     * @param _target Vault to pause.
     */
    function pauseRebase(address _target) external onlyOperator {
        _execPause(_target, IVault.pauseRebase.selector);
        emit RebasePauseExecuted(_target);
    }

    /**
     * @notice Halt an allow-listed ARM, which exposes a no-argument `pause()`.
     * @param _target ARM to pause.
     */
    function pause(address _target) external onlyOperator {
        _execPause(_target, PAUSE_SELECTOR);
        emit PauseExecuted(_target);
    }

    /// @dev Execute a pause selector on `_target` through the Safe.
    function _execPause(address _target, bytes4 _selector) internal {
        require(isPausableTarget[_target], "Target not allowed");

        bool success = safeContract.execTransactionFromModule(
            _target,
            0, // Value
            abi.encodeWithSelector(_selector),
            0 // Call
        );

        require(success, "Pause failed");
    }

    /**
     * @notice Allow this module to pause a contract. Only the Safe can call.
     * @param _target Contract to add to the allow-list.
     */
    function allowTarget(address _target) external onlySafe {
        _allowTarget(_target);
    }

    function _allowTarget(address _target) internal {
        // A Safe module call to a codeless address succeeds, so an EOA or a
        // mistyped address here would make `_execPause` report a pause that
        // never happened. Checked at allow-list time rather than on the
        // latency-critical pause path. Also covers address(0).
        require(_target.code.length > 0, "Target has no code");
        require(!isPausableTarget[_target], "Target already allowed");
        isPausableTarget[_target] = true;
        emit TargetAllowed(_target);
    }

    /**
     * @notice Stop this module being able to pause a contract. Only the Safe
     *         can call.
     * @param _target Contract to remove from the allow-list.
     */
    function revokeTarget(address _target) external onlySafe {
        require(isPausableTarget[_target], "Target not allowed");
        isPausableTarget[_target] = false;
        emit TargetRevoked(_target);
    }
}
