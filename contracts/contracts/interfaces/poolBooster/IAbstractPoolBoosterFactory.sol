// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

interface IAbstractPoolBoosterFactory {
    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        IPoolBoostCentralRegistry.PoolBoosterType boosterType;
    }

    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function oToken() external view returns (address);

    function centralRegistry() external view returns (address);

    function poolBoosters(uint256 index)
        external
        view
        returns (address boosterAddress, address ammPoolAddress, IPoolBoostCentralRegistry.PoolBoosterType boosterType);

    function poolBoosterFromPool(address ammPoolAddress)
        external
        view
        returns (address boosterAddress, address poolAddress, IPoolBoostCentralRegistry.PoolBoosterType boosterType);

    function bribeAll(address[] calldata _excludedPoolBoosterAddresses) external;

    function removePoolBooster(address _poolBoosterAddress) external;

    function poolBoosterLength() external view returns (uint256);
}
