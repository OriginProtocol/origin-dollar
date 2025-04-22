// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";
import { IPoolBoostCentralRegistry } from "../interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

/**
 * @title Abstract Pool booster factory
 * @author Origin Protocol Inc
 */
contract AbstractPoolBoosterFactory is Governable {
    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        IPoolBoostCentralRegistry.PoolBoosterType boosterType;
    }

    // @notice address of Origin Sonic
    address public immutable oSonic;
    // @notice Central registry contract
    IPoolBoostCentralRegistry public immutable centralRegistry;

    // @notice list of all the pool boosters created by this factory
    PoolBoosterEntry[] public poolBoosters;
    // @notice mapping of AMM pool to pool booster
    mapping(address => PoolBoosterEntry) public poolBoosterFromPool;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    // @param address _centralRegistry address of the central registry
    constructor(
        address _oSonic,
        address _governor,
        address _centralRegistry
    ) {
        require(_oSonic != address(0), "Invalid oSonic address");
        require(_governor != address(0), "Invalid governor address");
        require(
            _centralRegistry != address(0),
            "Invalid central registry address"
        );

        oSonic = _oSonic;
        centralRegistry = IPoolBoostCentralRegistry(_centralRegistry);
        _setGovernor(_governor);
    }

    /**
     * @notice Goes over all the pool boosters created by this factory and
     *         calls bribe() on them.
     * @param _exclusionList A list of pool booster addresses to skip when
     *        calling this function.
     */
    function bribeAll(address[] memory _exclusionList) external {
        uint256 lengthI = poolBoosters.length;
        for (uint256 i = 0; i < lengthI; i++) {
            address poolBoosterAddress = poolBoosters[i].boosterAddress;
            bool skipBribeCall = false;
            uint256 lengthJ = _exclusionList.length;
            for (uint256 j = 0; j < lengthJ; j++) {
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

                centralRegistry.emitPoolBoosterRemoved(_poolBoosterAddress);
                break;
            }
        }
    }

    function _storePoolBoosterEntry(
        address _poolBoosterAddress,
        address _ammPoolAddress,
        IPoolBoostCentralRegistry.PoolBoosterType _boosterType
    ) internal {
        PoolBoosterEntry memory entry = PoolBoosterEntry(
            _poolBoosterAddress,
            _ammPoolAddress,
            _boosterType
        );

        poolBoosters.push(entry);
        poolBoosterFromPool[_ammPoolAddress] = entry;

        // emit the events of the pool booster created
        centralRegistry.emitPoolBoosterCreated(
            _poolBoosterAddress,
            _ammPoolAddress,
            _boosterType
        );
    }

    function _deployContract(bytes memory _bytecode, uint256 _salt)
        internal
        returns (address _address)
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            _address := create2(
                0,
                add(_bytecode, 0x20),
                mload(_bytecode),
                _salt
            )
        }

        require(
            _address.code.length > 0 && _address != address(0),
            "Failed creating a pool booster"
        );
    }

    // pre-compute the address of the deployed contract that will be
    // created when create2 is called
    function _computeAddress(bytes memory _bytecode, uint256 _salt)
        internal
        view
        returns (address)
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                _salt,
                keccak256(_bytecode)
            )
        );

        // cast last 20 bytes of hash to address
        return address(uint160(uint256(hash)));
    }

    function poolBoosterLength() external view returns (uint256) {
        return poolBoosters.length;
    }
}
