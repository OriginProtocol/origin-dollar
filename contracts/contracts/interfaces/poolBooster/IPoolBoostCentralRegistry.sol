// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IPoolBoostCentralRegistry {
    /**
     * @dev all the supported pool booster types are listed here. It is possible
     *      to have multiple versions of the factory that supports the same type of
     *      pool booster. Factories are immutable and this can happen when a factory
     *      or related pool booster required code update.
     *      e.g. "PoolBoosterSwapxDouble" & "PoolBoosterSwapxDouble_v2"
     */
    enum PoolBoosterType {
        // Supports bribing 2 contracts per pool. Appropriate for Ichi vault concentrated
        // liquidity pools where (which is expected in most/all cases) both pool gauges
        // require bribing.
        SwapXDoubleBooster,
        // Supports bribing a single contract per pool. Appropriate for Classic Stable &
        // Classic Volatile pools and Ichi vaults where only 1 side (1 of the 2 gauges)
        // needs bribing
        SwapXSingleBooster,
        // Supports bribing a single contract per pool. Appropriate for Metropolis pools
        MetropolisBooster,
        // Supports creating a Merkl campaign.
        MerklBooster,
        // Supports creating a plain Curve pool booster
        CurvePoolBoosterPlain
    }

    struct PoolBoosterEntry {
        address boosterAddress;
        address ammPoolAddress;
        PoolBoosterType boosterType;
    }

    event PoolBoosterCreated(
        address poolBoosterAddress,
        address ammPoolAddress,
        PoolBoosterType poolBoosterType,
        address factoryAddress
    );
    event PoolBoosterRemoved(address poolBoosterAddress);

    function emitPoolBoosterCreated(
        address _poolBoosterAddress,
        address _ammPoolAddress,
        PoolBoosterType _boosterType
    ) external;

    function emitPoolBoosterRemoved(address _poolBoosterAddress) external;
}
