// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { PoolBoosterMetropolis } from "./PoolBoosterMetropolis.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating Metropolis pool boosters.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactoryMetropolis is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;
    address public immutable rewardFactory;
    address public immutable voter;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    // @param address _centralRegistry address of the central registry
    // @param address _rewardFactory address of the Metropolis reward factory
    // @param address _voter address of the Metropolis voter
    constructor(
        address _oSonic,
        address _governor,
        address _centralRegistry,
        address _rewardFactory,
        address _voter
    ) AbstractPoolBoosterFactory(_oSonic, _governor, _centralRegistry) {
        rewardFactory = _rewardFactory;
        voter = _voter;
    }

    /**
     * @dev Create a Pool Booster for Metropolis pool.
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `computePoolBoosterAddress` in order for the final deployed address
     *        and pre-computed address to match
     */
    function createPoolBoosterMetropolis(address _ammPoolAddress, uint256 _salt)
        external
        onlyGovernor
    {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(
                type(PoolBoosterMetropolis).creationCode,
                abi.encode(oSonic, rewardFactory, _ammPoolAddress, voter)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.MetropolisBooster
        );
    }

    /**
     * @dev Create a Pool Booster for Metropolis pool.
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `createPoolBoosterMetropolis` in order for the final deployed address
     *        and pre-computed address to match
     */
    function computePoolBoosterAddress(address _ammPoolAddress, uint256 _salt)
        external
        view
        returns (address)
    {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");

        return
            _computeAddress(
                abi.encodePacked(
                    type(PoolBoosterMetropolis).creationCode,
                    abi.encode(oSonic, rewardFactory, _ammPoolAddress, voter)
                ),
                _salt
            );
    }
}
