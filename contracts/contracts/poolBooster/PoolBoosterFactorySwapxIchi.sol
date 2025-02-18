// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { PoolBoosterSwapxIchi } from "./PoolBoosterSwapxIchi.sol";
import { AbstractPoolBoosterFactory } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating SwapxIchi pool boosters
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxIchi is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    constructor(address _oSonic, address _governor)
        AbstractPoolBoosterFactory(_oSonic, _governor)
    {}

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
                type(PoolBoosterSwapxIchi).creationCode,
                abi.encode(_bribeAddressOS, _bribeAddressOther, oSonic, _split)
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            PoolBoosterType.SwapXIchiVault
        );
    }
}
