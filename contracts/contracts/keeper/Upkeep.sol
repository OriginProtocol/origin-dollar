pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

/**
 * @title OUSD Keeper Contract
 * @notice The Keeper is used to perform maintenance on vaults
 * @author Origin Protocol Inc
 */

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IKeeper } from "../interfaces/IKeeper.sol";
import "../vault/VaultCore.sol";
import "../token/OUSD.sol";
import "../governance/Governable.sol";

contract Upkeep is IKeeper, Governable {
    using SafeMath for uint256;

    VaultCore vaultCore;
    OUSD oUSD;

    string private constant REBASE_ALLOCATE_UPKEEP_ID = "rebasePlusAllocate";
    string private constant REBASE_UPKEEP_ID = "rebase";
    string private constant ALLOCATE_UPKEEP_ID = "allocate";

    // Threshhold for rebase in OUSD - TODO make this configurable via governor
    uint256 private constant REBASE_THRESHHOLD = 25000 ether;

    // Interval for running a rebase - TODO make this configurable via governor
    uint256 private constant ALLOCATE_INTERVAL = 1 seconds;

    // Stored indicator for next rebase time
    uint256 private nextAllocate;

    event UpkeepEvent(string upkeepId, uint256 time);

    // /*
    //  * @notice modifier that allows it to be simulated via eth_call by checking
    //  * that the sender is the zero address.
    //  */
    // modifier cannotExecute()
    // {
    //   preventExecution();
    //   _;
    // }

    //  /*
    //  * @notice method that allows it to be simulated via eth_call by checking that
    //  * the sender is the zero address.
    //  */
    // function preventExecution() internal view {
    //   console.log('In preventExecution');
    //   console.log(tx.origin);
    //   require(tx.origin == address(0), "only for simulated backend");
    // }

    constructor(address payable _vaultCoreAddr, address payable _ousdAddr)
        public
    {
        vaultCore = VaultCore(_vaultCoreAddr);
        oUSD = OUSD(_ousdAddr);
        _bumpNextAllocate();
    }

    /*
     * @notice method that is simulated by the keepers to see if any work actually
     * needs to be performed. This method does does not actually need to be
     * executable, and since it is only ever simulated it can consume lots of gas.
     * @dev To ensure that it is never called, you may want to add the
     * cannotExecute modifier from KeeperBase to your implementation of this
     * method.
     * @return success boolean to indicate whether the keeper should call
     * performUpkeep or not.
     * @return success bytes that the keeper should call performUpkeep with, if
     * upkeep is needed.
     */

    function checkUpkeep(bytes calldata _upkeepId)
        external
        returns (
            //cannotExecute
            bool success,
            bytes memory dynamicData
        )
    {
        string memory upkeepId = abi.decode(_upkeepId, (string));
        (bool runnable, string memory message) = _checkUpkeepId(upkeepId); // proactive check
        return (runnable, _upkeepId);
    }

    function performUpkeep(bytes calldata _upkeepId) external nonReentrant {
        string memory upkeepId = abi.decode(_upkeepId, (string));
        (bool runnable, string memory message) = _checkUpkeepId(upkeepId); // proactive check

        // Fail here if no upkeeps are runnable
        require(runnable, message);

        if (_isEqual(upkeepId, REBASE_ALLOCATE_UPKEEP_ID)) {
            _rebaseAndAllocate();
        } else if (_isEqual(upkeepId, REBASE_UPKEEP_ID)) {
            _rebase();
        } else if (_isEqual(upkeepId, ALLOCATE_UPKEEP_ID)) {
            _allocate();
        } else {
            revert("Unable to perform upkeep");
        }
    }

    function _isEqual(string memory _upkeepId, string memory _upkeepType)
        internal
        view
        returns (bool)
    {
        return keccak256(bytes(_upkeepId)) == keccak256(bytes(_upkeepType));
    }

    function _checkUpkeepId(string memory _upkeepId)
        internal
        view
        returns (bool, string memory)
    {
        // Verify the upkeepId is a known value
        bool validId = keccak256(bytes(_upkeepId)) ==
            keccak256(bytes(REBASE_ALLOCATE_UPKEEP_ID)) ||
            keccak256(bytes(_upkeepId)) == keccak256(bytes(REBASE_UPKEEP_ID)) ||
            keccak256(bytes(_upkeepId)) == keccak256(bytes(ALLOCATE_UPKEEP_ID));

        if (!validId) {
            return (false, "Unknown upkeep Id");
        }

        // Check if an upkeepId is runnable
        bool runnable = false;
        if (_isEqual(_upkeepId, REBASE_ALLOCATE_UPKEEP_ID)) {
            bool rebase = _shouldRebase();
            bool allocate = _shouldAllocate();
            runnable = rebase || allocate;
        } else if (_isEqual(_upkeepId, REBASE_UPKEEP_ID)) {
            runnable = _shouldRebase();
        } else if (_isEqual(_upkeepId, ALLOCATE_UPKEEP_ID)) {
            runnable = _shouldAllocate();
        }

        if (!runnable) {
            return (false, "No upkeep is runnable with given Id");
        }

        return (true, "Upkeep is runnable");
    }

    function _shouldRebase() internal view returns (bool) {
        uint256 vaultValue = vaultCore.totalValue();
        uint256 ousdSupply = oUSD.totalSupply();

        if (ousdSupply == 0) {
            return false;
        }

        bool rebase = (vaultValue.add(REBASE_THRESHHOLD)) > ousdSupply;

        return rebase;
    }

    function _shouldAllocate() internal view returns (bool) {
        uint256 timestamp = now;
        bool allocate = now >= nextAllocate;

        return allocate;
    }

    function _rebaseAndAllocate() internal {
        bool rebase = _shouldRebase();
        bool allocate = _shouldAllocate();

        require(rebase || allocate, "No keeper actions are callable");

        if (allocate) {
            _allocate();
        }

        if (rebase) {
            _rebase();
        }
    }

    function _rebase() internal {
        bool rebase = _shouldRebase();

        require(rebase, "No keeper actions are callable");

        if (rebase) {
            vaultCore.rebase();
        }

        emit UpkeepEvent({ upkeepId: REBASE_UPKEEP_ID, time: now });
    }

    function _allocate() internal {
        bool allocate = _shouldAllocate();

        require(allocate, "No keeper actions are callable");

        if (allocate) {
            _bumpNextAllocate();
            vaultCore.allocate();
        }

        emit UpkeepEvent({ upkeepId: ALLOCATE_UPKEEP_ID, time: now });
    }

    function _bumpNextAllocate() internal {
        nextAllocate = now.add(ALLOCATE_INTERVAL);
    }
}
