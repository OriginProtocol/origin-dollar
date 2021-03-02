pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

import "hardhat/console.sol";

/**
 * @title OUSD Keeper Contract
 * @notice The Keeper is used to perform maintenance on vaults
 * @author Origin Protocol Inc
 */

import { IKeeper } from "../interfaces/IKeeper.sol";
import "../vault/VaultCore.sol";
import "../token/OUSD.sol";
import "../governance/Governable.sol";

contract Keeper is IKeeper, Governable {

  VaultCore vaultCore;
  OUSD oUSD;

  string CHECK  = 'check';
  string EXECUTE  = 'execute';

  string ALLOCATE  = 'allocate';
  string REBASE  = 'rebase';

  uint constant private rebaseThreshold = 25000 ether;
  uint private nextAllocate;

  struct KeepInfo {
        ActionInfo rebaseInfo;
        ActionInfo allocateInfo;
    }  

  struct ActionInfo {
        string actionType;
        bool run;
        string param;
    } 

  struct RebaseInfo {
        bool run;
        string param;
    }     

  struct DummyInfo {
        bool rebase;
        bool allocate;
        uint256 time;
  } 

  event KeeperEvent(
        string action,
        bool success,
        bool rebase,
        bool allocate
    );    

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

  constructor(address payable _vaultCoreAddr, address payable _ousdAddr) public {
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
   
  function checkUpkeep (
    bytes calldata _data
  )
    // view
    external
    //cannotExecute
    returns (
      bool success,
      bytes memory dynamicData
    ) {

      bool rebase = shouldRebase();
      bool allocate = shouldAllocate();
      bool isSuccessful = rebase || allocate;

      ActionInfo memory rebaseInfo = ActionInfo({actionType: REBASE, run: rebase, param: "foo"});
      ActionInfo memory allocateInfo = ActionInfo({actionType: ALLOCATE, run: allocate, param: "foo"});
      KeepInfo memory keepInfo = KeepInfo({rebaseInfo: rebaseInfo, allocateInfo: allocateInfo});
      
      bytes memory data = abi.encode(keepInfo);
      return (isSuccessful, data);
    }

  function performUpkeep(
    bytes calldata dynamicData
  ) external {
    KeepInfo memory keepInfo = abi.decode(dynamicData, (KeepInfo));

    require(keepInfo.rebaseInfo.run || keepInfo.allocateInfo.run, "No keeper actions are enabled");
    require(shouldRebase() || shouldAllocate(), "No keeper actions are callable");

    if(keepInfo.rebaseInfo.run) {
      vaultCore.rebase();
    }
    
    if(keepInfo.allocateInfo.run) {
      vaultCore.allocate();
      nextAllocate = now + 1 days; 
    }
  }

  function shouldRebase() view internal returns (bool) {
    uint vaultValue = vaultCore.totalValue();
    uint256 ousdSupply = oUSD.totalSupply();

    if(ousdSupply == 0) {
        return false;
    }

    bool rebase = (vaultValue + rebaseThreshold) > ousdSupply;

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

  function shouldAllocate() view internal returns (bool) {

    uint timestamp = now;
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