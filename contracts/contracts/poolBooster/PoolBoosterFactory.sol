// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { PoolBoosterSwapxIchi } from "./PoolBoosterSwapxIchi.sol";

/**
 * @title Pool booster factory
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactory is Strategizable, Initializable {
    /**
     * @dev all the supported pool booster types are listed here. It is possible
     * to have multiple versions of the same pool booster gauge implementation. 
     * e.g. "SwapXIchiVault" & "SwapXIchiVault_v2"
     */
    enum PoolBoosterType { 
        SwapXIchiVault,
        SwapStableSwap
    }

    struct PoolBoosterEntry {
        address boosterAddress;
        PoolBoosterType boosterType;
    }

    // list of all the pool boosters
    PoolBoosterEntry[] public poolBoosters;

    constructor(){
        // implementation contract has no governor
        _setGovernor(address(0));
    }

    /**
     * @dev Initialize the state
     * @param strategist address of strategist
     */
    function initialize(
        address governor,
        address strategist
    ) public onlyGovernor initializer {
        _setGovernor(governor);
        _setStrategistAddr(strategist);
    }

    /**
     * @dev Create a Pool Booster for SwapX Ichi vault based pool
     * @param bribeAdressOS address of the Bribes.sol(Bribe) contract for the OS token side
     * @param bribeAdressOther address of the  Bribes.sol(Bribe) contract for the other token in the pool
     * @param split 1e18 denominated split between OS and Other bribe. E.g. 0.4e17 means 40% to OS
     *        bribe contract and 60% to other bribe contract
     */
    function createPoolBoosterSwapxIchi(
        address bribeAdressOS,
        address bribeAdressOther,
        uint256 split
    ) external onlyGovernor {


        //abi.encodePacked(bytecode, abi.encode(arg1, arg2));
    }

    function _deployContract(
        bytes memory bytecode
    ) internal returns(address _address) {
        uint256 salt = 1;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _address := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
    }

}
