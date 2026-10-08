// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IPoolBoostCentralRegistry } from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

interface ICurvePoolBoosterFactory {
    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        IPoolBoostCentralRegistry.PoolBoosterType boosterType;
    }

    function initialize(
        address _governor,
        address _strategist,
        address _centralRegistry
    ) external;

    function governor() external view returns (address);

    function isGovernor() external view returns (bool);

    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function strategistAddr() external view returns (address);

    function centralRegistry() external view returns (address);

    function createCurvePoolBoosterPlain(
        address _rewardToken,
        address _gauge,
        address _feeCollector,
        uint16 _fee,
        address _campaignRemoteManager,
        address _votemarket,
        bytes32 _salt,
        address _expectedAddress
    ) external returns (address);

    function removePoolBooster(address _poolBoosterAddress) external;

    function computePoolBoosterAddress(
        address _rewardToken,
        address _gauge,
        bytes32 _salt
    ) external view returns (address);

    function encodeSaltForCreateX(uint256 salt)
        external
        view
        returns (bytes32 encodedSalt);

    function poolBoosterLength() external view returns (uint256);

    function getPoolBoosters()
        external
        view
        returns (PoolBoosterEntry[] memory);

    function poolBoosters(uint256 index)
        external
        view
        returns (
            address boosterAddress,
            address ammPoolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType boosterType
        );

    function poolBoosterFromPool(address ammPoolAddress)
        external
        view
        returns (
            address boosterAddress,
            address poolAddress,
            IPoolBoostCentralRegistry.PoolBoosterType boosterType
        );
}
