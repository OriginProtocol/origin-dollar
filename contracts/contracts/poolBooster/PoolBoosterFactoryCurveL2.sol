// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { AbstractPoolBoosterFactory, IPoolBoostCentralRegistry } from "./AbstractPoolBoosterFactory.sol";
import { PoolBoosterCurveL2 } from "./PoolBoosterCurveL2.sol";

/**
 * @title Pool booster factory for creating Swapx Ichi pool boosters where both of the
 *        gauges need incentivizing.
 * @author Origin Protocol Inc
 */
contract PoolBoosterFactorySwapxDouble is AbstractPoolBoosterFactory {
    uint256 public constant version = 1;

    /// @notice Address of the votemarket contract
    address public votemarket;

    event VotemarketUpdated(address votemarket);

    // @param address _oSonic address of the OSonic token
    // @param address _governor address governor
    // @param address _centralRegistry address of the central registry
    constructor(
        address _oSonic,
        address _governor,
        address _centralRegistry,
        address _votemarket
    ) AbstractPoolBoosterFactory(_oSonic, _governor, _centralRegistry) {
        require(_votemarket != address(0), "Invalid votemarket address");
        _setVotemarket(_votemarket);
    }

    /**
     * @dev Create a Pool Booster for SwapX Ichi vault based pool where 2 Bribe contracts need to be
     *      bribed
     * @param _gauge address of the gauge to bribe
     * @param _pool address of the pool linked to the gauge
     * @param _strategist address of the strategist
     * @param _fee fee in FEE_BASE unit paid when managing campaign.
     * @param _feeCollector address of the fee collector
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `computePoolBoosterAddress` in order for the final deployed address
     *        and pre-computed address to match
     */
    function createPoolBoosterCurveL2(
        address _gauge,
        address _pool,
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        uint256 _salt
    ) external onlyGovernor {
        require(_gauge != address(0), "Invalid gaugeAddress address");
        require(_pool != address(0), "Invalid pool address");
        require(_strategist != address(0), "Invalid strategist address");
        require(_salt > 0, "Invalid salt");

        address poolBoosterAddress = _deployContract(
            abi.encodePacked(
                type(PoolBoosterCurveL2).creationCode,
                abi.encode(
                    oSonic,
                    _gauge,
                    votemarket,
                    _strategist,
                    _fee,
                    _feeCollector
                )
            ),
            _salt
        );

        _storePoolBoosterEntry(
            poolBoosterAddress,
            _pool,
            IPoolBoostCentralRegistry.PoolBoosterType.CurveL2Booster
        );
    }

    /**
     * @dev Compute the address of the pool booster to be deployed.
     * @param _gauge address of the gauge to bribe
     * @param _strategist address of the strategist
     * @param _fee fee in FEE_BASE unit paid when managing campaign.
     * @param _feeCollector address of the fee collector
     * @param _salt A unique number that affects the address of the pool booster created. Note: this number
     *        should match the one from `createPoolBoosterSwapxDouble` in order for the final deployed address
     *        and pre-computed address to match
     */
    function computePoolBoosterAddress(
        address _gauge,
        address _strategist,
        uint16 _fee,
        address _feeCollector,
        uint256 _salt
    ) external view returns (address) {
        require(_gauge != address(0), "Invalid gaugeAddress address");
        require(_strategist != address(0), "Invalid strategist address");
        require(_salt > 0, "Invalid salt");

        return
            _computeAddress(
                abi.encodePacked(
                    type(PoolBoosterCurveL2).creationCode,
                    abi.encode(
                        oSonic,
                        _gauge,
                        votemarket,
                        _strategist,
                        _fee,
                        _feeCollector
                    )
                ),
                _salt
            );
    }

    /**
     * @notice Set the votemarket address
     * @param _votemarket address of the votemarket contract
     */
    function setVotemarket(address _votemarket) external onlyGovernor {
        _setVotemarket(_votemarket);
    }

    /**
     * @notice Internal logic to set the votemarket address
     * @param _votemarket address of the votemarket contract
     */
    function _setVotemarket(address _votemarket) internal {
        votemarket = _votemarket;
        emit VotemarketUpdated(_votemarket);
    }
}
