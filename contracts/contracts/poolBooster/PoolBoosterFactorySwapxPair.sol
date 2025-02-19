// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { PoolBoosterSwapxPair } from "./PoolBoosterSwapxPair.sol";
import { AbstractPoolBoosterFactory } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating SwapxIchi pool boosters
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxPair is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    constructor(address _oSonic, address _governor)
        AbstractPoolBoosterFactory(_oSonic, _governor)
    {}

    /**
     * @dev Create a Pool Booster for SwapX classic volatile or classic stable pools
     * @param _bribeAddress address of the Bribes.sol contract
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     */
    function createPoolBoosterSwapxClassic(
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
                type(PoolBoosterSwapxPair).creationCode,
                abi.encode(_bribeAddress, oSonic)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            PoolBoosterType.SwapXClassicPool
        );
    }
}
