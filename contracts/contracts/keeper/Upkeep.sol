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

    string private constant ALLOCATE = "allocate";
    string private constant REBASE = "rebase";

    uint256 private constant rebaseThreshold = 25000 ether;
    uint256 private nextAllocate;

    event UpkeepEvent(string action, uint256 time);

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
        nextAllocate = now + 1 days;
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

    function checkUpkeep(bytes calldata _data)
        external
        returns (
            // view
            //cannotExecute
            bool success,
            bytes memory dynamicData
        )
    {
        string memory upkeepId = abi.decode(_data, (string));
        string memory REBASE_ALLOCATE_ID = "rebasePlusAllocate"; // Smell
        require(keccak256(bytes(upkeepId)) == keccak256(bytes(REBASE_ALLOCATE_ID)), "Unknown upkeepId"); // proactive check - smelly
        if(keccak256(bytes(upkeepId)) == keccak256(bytes(REBASE_ALLOCATE_ID))) {
            bool rebase = shouldRebase();
            bool allocate = shouldAllocate();
            bool isSuccessful = rebase || allocate;
            return (isSuccessful, _data); // pass upkeepId through
        }
    }

    function performUpkeep(bytes calldata dynamicData) external nonReentrant {
        string memory REBASE_ALLOCATE_ID = "rebasePlusAllocate"; // Smell
        string memory upkeepId = abi.decode(dynamicData, (string));
        require(keccak256(bytes(upkeepId)) == keccak256(bytes(REBASE_ALLOCATE_ID)), "Unknown upkeepId"); // proactive check
        if(keccak256(bytes(upkeepId)) == keccak256(bytes(REBASE_ALLOCATE_ID))) {
            bool rebase = shouldRebase();
            bool allocate = shouldAllocate();

            require(rebase || allocate, "No keeper actions are callable");

            if (rebase) {
                vaultCore.rebase();
                emit UpkeepEvent({ action: REBASE, time: now });
            }

            if (allocate) {
                vaultCore.allocate();
                nextAllocate = now.add(1 days);
                emit UpkeepEvent({ action: ALLOCATE, time: now });
            }
        }
    }

    function shouldRebase() internal view returns (bool) {
        uint256 vaultValue = vaultCore.totalValue();
        uint256 ousdSupply = oUSD.totalSupply();

        if (ousdSupply == 0) {
            return false;
        }

        bool rebase = (vaultValue.add(rebaseThreshold)) > ousdSupply;

        console.log("*** shouldRebase ***");
        console.log("rebase");
        console.log(rebase);

        console.log("vaultValue");
        console.log(vaultValue);

        console.log("ousdSupply");
        console.log(ousdSupply);

        console.log("rebaseThreshold");
        console.log(rebaseThreshold);
        console.log("******");

        return rebase;
    }

    function shouldAllocate() internal view returns (bool) {
        uint256 timestamp = now;
        bool allocate = now >= nextAllocate;

        console.log("*** shouldAllocate ***");
        console.log("allocate");
        console.log(allocate);

        console.log("timestamp");
        console.log(timestamp);

        console.log("nextAllocate");
        console.log(nextAllocate);
        console.log("******");

        return allocate;
    }
}
