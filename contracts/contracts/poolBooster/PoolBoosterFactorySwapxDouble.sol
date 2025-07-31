// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { PoolBoosterSwapxDouble } from "./PoolBoosterSwapxDouble.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating Swapx Ichi pool boosters where both of the
 *        gauges need incentivizing.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxDouble is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    // @param address _centralRegistry address of the central registry
    constructor(
        address _oSonic,
        address _governor,
        address _centralRegistry
    ) AbstractPoolBoosterFactory(_oSonic, _governor, _centralRegistry) {}

    /**
     * @dev Create a Pool Booster for SwapX Ichi vault based pool where 2 Bribe contracts need to be
     *      bribed
     * @param _bribeAddressOS address of the Bribes.sol(Bribe) contract for the OS token side
     * @param _bribeAddressOther address of the Bribes.sol(Bribe) contract for the other token in the pool
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _split 1e18 denominated split between OS and Other bribe. E.g. 0.4e17 means 40% to OS
     *        bribe contract and 60% to other bribe contract
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `computePoolBoosterAddress` in order for the final deployed address
     *        and pre-computed address to match
     */
    function createPoolBoosterSwapxDouble(
        address _bribeAddressOS,
        address _bribeAddressOther,
        address _ammPoolAddress,
        uint256 _split,
        uint256 _salt
    ) external onlyGovernor {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(
                type(PoolBoosterSwapxDouble).creationCode,
                abi.encode(_bribeAddressOS, _bribeAddressOther, oSonic, _split)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXDoubleBooster
        );
    }

    /**
     * @dev Compute the address of the pool booster to be deployed.
     * @param _bribeAddressOS address of the Bribes.sol(Bribe) contract for the OS token side
     * @param _bribeAddressOther address of the Bribes.sol(Bribe) contract for the other token in the pool
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _split 1e18 denominated split between OS and Other bribe. E.g. 0.4e17 means 40% to OS
     *        bribe contract and 60% to other bribe contract
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `createPoolBoosterSwapxDouble` in order for the final deployed address
     *        and pre-computed address to match
     */
    function computePoolBoosterAddress(
        address _bribeAddressOS,
        address _bribeAddressOther,
        address _ammPoolAddress,
        uint256 _split,
        uint256 _salt
    ) external view returns (address) {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");

        return
            _computeAddress(
                abi.encodePacked(
                    type(PoolBoosterSwapxDouble).creationCode,
                    abi.encode(
                        _bribeAddressOS,
                        _bribeAddressOther,
                        oSonic,
                        _split
                    )
                ),
                _salt
            );
    }
}
