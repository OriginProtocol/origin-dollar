// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { PoolBoosterSwapxSingle } from "./PoolBoosterSwapxSingle.sol";
import { AbstractPoolBoosterFactory } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating Swapx Single pool boosters - where a single
 *        gauge is created for a pool. this is appropriate for Classic Stable & Classic
 *        Volatile SwapX pools.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxSingle is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    constructor(address _oSonic, address _governor)
        AbstractPoolBoosterFactory(_oSonic, _governor)
    {}

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
                abi.encode(_bribeAddress, oSonic)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            PoolBoosterType.SwapXSingleBooster
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
                    abi.encode(_bribeAddress, oSonic)
                ),
                _salt
            );
    }
}
