// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { PoolBoosterSwapxSingle } from "./PoolBoosterSwapxSingle.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating Swapx Single pool boosters - where a single
 *        gauge is created for a pool. this is appropriate for Classic Stable & Classic
 *        Volatile SwapX pools.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxSingle is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    // @param address _oToken address of the OToken token
    // @param address _governor address governor
    // @param address _centralRegistry address of the central registry
    constructor(
        address _oToken,
        address _governor,
        address _centralRegistry
    ) AbstractPoolBoosterFactory(_oToken, _governor, _centralRegistry) {}

    /**
     * @dev Create a Pool Booster for SwapX classic volatile or classic stable pools where
     *      a single Bribe contract is incentivized.
     * @param _bribeAddress address of the Bribes.sol contract
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `computePoolBoosterAddress` in order for the final deployed address
     *        and pre-computed address to match
     */
    function createPoolBoosterSwapxSingle(
        address _bribeAddress,
        address _ammPoolAddress,
        uint256 _salt
    ) external onlyGovernor {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(
                type(PoolBoosterSwapxSingle).creationCode,
                abi.encode(_bribeAddress, oToken)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.SwapXSingleBooster
        );
    }

    /**
     * @dev Create a Pool Booster for SwapX classic volatile or classic stable pools where
     *      a single Bribe contract is incentivized.
     * @param _bribeAddress address of the Bribes.sol contract
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `createPoolBoosterSwapxSingle` in order for the final deployed address
     *        and pre-computed address to match
     */
    function computePoolBoosterAddress(
        address _bribeAddress,
        address _ammPoolAddress,
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
                    type(PoolBoosterSwapxSingle).creationCode,
                    abi.encode(_bribeAddress, oToken)
                ),
                _salt
            );
    }
}
