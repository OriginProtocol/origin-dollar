// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { PoolBoosterSwapxIchi } from "./PoolBoosterSwapxIchi.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";

/**
 * @title Abstract Pool booster factory
 * @author Origin Protocol Inc
 */
contract AbstractPoolBoosterFactory is Governable {
    /**
     * @dev all the supported pool booster types are listed here. It is possible
     * to have multiple versions of the same pool booster gauge implementation.
     * e.g. "SwapXIchiVault" & "SwapXIchiVault_v2"
     */
    enum PoolBoosterType {
        SwapXIchiVault,
        SwapXClassicPool
    }

    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        PoolBoosterType boosterType;
    }

    event PoolBoosterDeployed(
        address poolBoosterAddress,
        address ammPoolAddress,
        PoolBoosterType poolBoosterType
    );
    event PoolBoosterRemoved(address poolBoosterAddress);

    // @notice address of Origin Sonic
    address public immutable oSonic;

    // @notice list of all the pool boosters
    PoolBoosterEntry[] public poolBoosters;
    // @notice mapping of AMM pool to pool booster
    mapping(address => PoolBoosterEntry) public poolBoosterFromPool;

    /// @notice Gap for upgrade safety
    uint256[48] private ___gap;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    constructor(address _oSonic, address _governor) {
        require(_oSonic != address(0), "Invalid oSonic address");
        require(_governor != address(0), "Invalid governor address");

        oSonic = _oSonic;
        _setGovernor(_governor);
    }

    /**
     * @notice Goes over all the pool boosters created by this factory and
     *         calls bribe() on them.
     * @param _exclusionList A list of pool booster addresses to skip when
     *        calling this function.
     */
    function bribeAll(address[] memory _exclusionList) external {
        uint256 length = poolBoosters.length;
        for (uint256 i = 0; i < length; i++) {
            address poolBoosterAddress = poolBoosters[i].boosterAddress;
            bool skipBribeCall = false;
            for (uint256 j = 0; j < _exclusionList.length; j++) {
                // pool booster in exclusion list
                if (_exclusionList[j] == poolBoosterAddress) {
                    skipBribeCall = true;
                    break;
                }
            }

            if (!skipBribeCall) {
                IPoolBooster(poolBoosterAddress).bribe();
            }
        }
    }

    /**
     * @notice Removes the pool booster from the internal list of pool boosters.
     * @dev This action does not destroy the pool booster contract nor does it
     *      stop the yield delegation to it.
     * @param _poolBoosterAddress address of the pool booster
     */
    function removePoolBooster(address _poolBoosterAddress)
        external
        onlyGovernor
    {
        uint256 boostersLen = poolBoosters.length;
        for (uint256 i = 0; i < boostersLen; ++i) {
            if (poolBoosters[i].boosterAddress == _poolBoosterAddress) {
                // erase mapping
                delete poolBoosterFromPool[poolBoosters[i].ammPoolAddress];

                // overwrite current pool booster with the last entry in the list
                poolBoosters[i] = poolBoosters[boostersLen - 1];
                // drop the last entry
                poolBoosters.pop();

                emit PoolBoosterRemoved(_poolBoosterAddress);
                break;
            }
        }
    }

    function _storePoolBoosterEntry(
        address _poolBoosterAddress,
        address _ammPoolAddress,
        PoolBoosterType boosterType
    ) internal {
        PoolBoosterEntry memory entry = PoolBoosterEntry(
            _poolBoosterAddress,
            _ammPoolAddress,
            boosterType
        );

        poolBoosters.push(entry);
        poolBoosterFromPool[_ammPoolAddress] = entry;

        emit PoolBoosterDeployed(
            _poolBoosterAddress,
            _ammPoolAddress,
            boosterType
        );
    }

    function _deployContract(bytes memory bytecode, uint256 _salt)
        internal
        returns (address _address)
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _address := create2(0, add(bytecode, 0x20), mload(bytecode), _salt)
        }

        require(
            _address.code.length > 0 && _address != address(0),
            "Failed creating a pool booster"
        );
    }

    function poolBoosterLength() external view returns (uint256) {
        return poolBoosters.length;
    }
}
