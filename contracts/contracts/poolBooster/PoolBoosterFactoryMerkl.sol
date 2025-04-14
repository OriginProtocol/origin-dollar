// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { PoolBoosterMerkl } from "./PoolBoosterMerkl.sol";
import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";

/**
 * @title Pool booster factory for creating Merkl pool boosters.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactoryMerkl is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    /// @notice address of the Merkl distributor
    address public merklDistributor;

    /// @notice event emitted when the Merkl distributor is updated
    event MerklDistributorUpdated(address newDistributor);

    /**
     * @param _oSonic address of the OSonic token
     * @param _governor address governor
     * @param _centralRegistry address of the central registry
     * @param _merklDistributor address of the Merkl distributor
     */
    constructor(
        address _oSonic,
        address _governor,
        address _centralRegistry,
        address _merklDistributor
    ) AbstractPoolBoosterFactory(_oSonic, _governor, _centralRegistry) {
        _setMerklDistributor(_merklDistributor);
    }

    /**
     * @dev Create a Pool Booster for Merkl.
     * @param _campaignType The type of campaign to create. This is used to determine the type of
     *        bribe contract to create. The type is defined in the MerklDistributor contract.
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _campaignDuration The duration of the campaign in seconds
     * @param campaignData The data to be used for the campaign. This is used to determine the type of
     *        bribe contract to create. The type is defined in the MerklDistributor contract.
     *        This should be fetched from the Merkl UI.
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `computePoolBoosterAddress` in order for the final deployed address
     *        and pre-computed address to match
     */
    function createPoolBoosterMerkl(
        uint32 _campaignType,
        address _ammPoolAddress,
        uint32 _campaignDuration,
        bytes calldata campaignData,
        uint256 _salt
    ) external onlyGovernor {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");
        require(_campaignDuration > 1 hours, "Invalid campaign duration");
        require(campaignData.length > 0, "Invalid campaign data");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(
                type(PoolBoosterMerkl).creationCode,
                abi.encode(
                    oSonic,
                    merklDistributor,
                    _campaignDuration,
                    _campaignType,
                    governor(),
                    campaignData
                )
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster
        );
    }

    /**
     * @dev Create a Pool Booster for Merkl.
     * @param _campaignType The type of campaign to create. This is used to determine the type of
     *        bribe contract to create. The type is defined in the MerklDistributor contract.
     * @param _ammPoolAddress address of the AMM pool where the yield originates from
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `createPoolBoosterMerkl` in order for the final deployed address
     *        and pre-computed address to match
     */
    function computePoolBoosterAddress(
        uint32 _campaignType,
        address _ammPoolAddress,
        uint32 _campaignDuration,
        bytes calldata campaignData,
        uint256 _salt
    ) external view returns (address) {
        require(
            _ammPoolAddress != address(0),
            "Invalid ammPoolAddress address"
        );
        require(_salt > 0, "Invalid salt");
        require(_campaignDuration > 1 hours, "Invalid campaign duration");
        require(campaignData.length > 0, "Invalid campaign data");

        return
            _computeAddress(
                abi.encodePacked(
                    type(PoolBoosterMerkl).creationCode,
                    abi.encode(
                        oSonic,
                        merklDistributor,
                        _campaignDuration,
                        _campaignType,
                        governor(),
                        campaignData
                    )
                ),
                _salt
            );
    }

    /**
     * @dev Set the address of the Merkl distributor
     * @param _merklDistributor The address of the Merkl distributor
     */
    function setMerklDistributor(address _merklDistributor)
        external
        onlyGovernor
    {
        _setMerklDistributor(_merklDistributor);
    }

    function _setMerklDistributor(address _merklDistributor) internal {
        require(
            _merklDistributor != address(0),
            "Invalid merklDistributor address"
        );
        merklDistributor = _merklDistributor;
        emit MerklDistributorUpdated(_merklDistributor);
    }
}
