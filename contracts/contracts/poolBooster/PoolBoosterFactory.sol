// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Strategizable } from "../governance/Strategizable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { PoolBoosterSwapxIchi } from "./PoolBoosterSwapxIchi.sol";
import { PoolBoosterSwapxPair } from "./PoolBoosterSwapxPair.sol";
import { IPoolBooster } from "../interfaces/poolBooster/IPoolBooster.sol";

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
        SwapXClassicPool
    }

    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        PoolBoosterType boosterType;
    }

    event PoolBoosterDeployed(address poolBoosterAddress, address ammPoolAddress, PoolBoosterType poolBoosterType);
    event PoolBoosterRemoved(address poolBoosterAddress);

    // @notice address of Origin Sonic
    address public immutable oSonic;

    // @notice list of all the pool boosters
    PoolBoosterEntry[] public poolBoosters;
    // @notice mapping of AMM pool to pool booster
    mapping(address => PoolBoosterEntry) public poolBoosterFromPool;

    constructor(address _oSonic){
        oSonic = _oSonic;
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

    function bribeAll() external {
        uint256 length = poolBoosters.length;
        for(uint256 i = 0; i < length; i++) {
            IPoolBooster(poolBoosters[i].boosterAddress).bribe();
        }
    }

    /**
     * @notice Removes the pool booster from the internal list of pool boosters. 
     * @dev This action does not destroy the pool booster contract nor does it 
     *      stop the yield delegation to it.
     * @param _poolBoosterAddress address of the pool booster
     */
    function removePoolBooster(address _poolBoosterAddress) external onlyGovernor {
        uint256 boostersLen = poolBoosters.length;
        for (uint256 i = 0; i < boostersLen; ++i) {
            if (poolBoosters[i].boosterAddress == _poolBoosterAddress) {

                // erase mapping
                delete poolBoosterFromPool[poolBoosters[i].ammPoolAddress];
                // erase array entry
                poolBoosters[i].boosterAddress = poolBoosters[boostersLen - 1].boosterAddress;
                poolBoosters[i].ammPoolAddress = poolBoosters[boostersLen - 1].ammPoolAddress;
                poolBoosters[i].boosterType = poolBoosters[boostersLen - 1].boosterType;
                poolBoosters.pop();

                emit PoolBoosterRemoved(_poolBoosterAddress);
                break;
            }
        }
    }

    /**
     * @dev Create a Pool Booster for SwapX Ichi vault based pool
     * @param _bribeAddressOS address of the Bribes.sol(Bribe) contract for the OS token side
     * @param _bribeAddressOther address of the Bribes.sol(Bribe) contract for the other token in the pool
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _split 1e18 denominated split between OS and Other bribe. E.g. 0.4e17 means 40% to OS
     *        bribe contract and 60% to other bribe contract
     */
    function createPoolBoosterSwapxIchi(
        address _bribeAddressOS,
        address _bribeAddressOther,
        address _ammPoolAddress,
        uint256 _split
    ) external onlyGovernor {
        require(_bribeAddressOS != address(0), "Invalid bribeAdressOS address");
        require(_bribeAddressOther != address(0), "Invalid bribeAdressOther address");
        require(_ammPoolAddress != address(0), "Invalid ammPoolAddress address");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(type(PoolBoosterSwapxIchi).creationCode, abi.encode(
                _bribeAddressOS,
                _bribeAddressOther,
                oSonic,
                _split  
            ))
        );

        PoolBoosterEntry memory entry = PoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            PoolBoosterType.SwapXIchiVault
        );

        poolBoosters.push(entry);
        poolBoosterFromPool[_ammPoolAddress] = entry;

        emit PoolBoosterDeployed(poolBoosterAddress, _ammPoolAddress, PoolBoosterType.SwapXIchiVault);
    }

    /**
     * @dev Create a Pool Booster for SwapX classic volatile or classic stable pools
     * @param _bribeAddress address of the Bribes.sol contract
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     */
    function createPoolBoosterSwapxClassic(
        address _bribeAddress,
        address _ammPoolAddress
    ) external onlyGovernor {
        require(_bribeAddress != address(0), "Invalid bribeAdress address");
        require(_ammPoolAddress != address(0), "Invalid ammPoolAddress address");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(type(PoolBoosterSwapxPair).creationCode, abi.encode(
                _bribeAddress,
                oSonic
            ))
        );

        PoolBoosterEntry memory entry = PoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            PoolBoosterType.SwapXClassicPool
        );

        poolBoosters.push(entry);
        poolBoosterFromPool[_ammPoolAddress] = entry;

        emit PoolBoosterDeployed(poolBoosterAddress, _ammPoolAddress, PoolBoosterType.SwapXClassicPool);
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

    function poolBoosterLength() external view returns(uint256) {
        return poolBoosters.length;
    }

}
