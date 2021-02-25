pragma solidity 0.5.11;

pragma experimental ABIEncoderV2;

/**
 * @title OUSD Keeper Contract
 * @notice The Keeper is used to perform maintenance on vaults
 * @author Origin Protocol Inc
 */

import { IKeeper } from "../interfaces/IKeeper.sol";
import "../vault/VaultCore.sol";
import "../governance/Governable.sol";

contract Keeper is IKeeper, Governable {

  VaultCore vaultCore;

  struct KeepInfo {
        AllocateInfo allocate;
        RebaseInfo rebase;
    }

  struct AllocateInfo {
        bool shouldRun;
        string allocateSpecificParam;
    } 

  struct RebaseInfo {
        bool shouldRun;
        string rebaseSpecificParam;
    }   

  event KeeperEvent(
        KeepInfo info,
        uint256 time
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

  //   /*
  //  * @notice method that allows it to be simulated via eth_call by checking that
  //  * the sender is the zero address.
  //  */
  // function preventExecution() internal view {
  //   require(tx.origin == address(0), "only for simulated backend");
  // }

  constructor(address payable _vaultCoreAddr) public {
    vaultCore = VaultCore(_vaultCoreAddr);
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
    bytes calldata data
  )
    external
    // cannotExecute
    returns (
      bool success,
      bytes memory dynamicData
    ) {
      AllocateInfo memory allocate = AllocateInfo({shouldRun: false, allocateSpecificParam: "alway's allocatin'"});
      RebaseInfo memory rebase = RebaseInfo({shouldRun: false, rebaseSpecificParam: "alway's rebasin'"});
      bytes memory data = abi.encode(KeepInfo({allocate: allocate, rebase: rebase}));
      return (false, data);
    }

  function performUpkeep(
    bytes calldata dynamicData
  ) external {
    KeepInfo memory keepInfo = abi.decode(dynamicData, (KeepInfo));
  }

}