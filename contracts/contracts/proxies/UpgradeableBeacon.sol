// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy, Address } from "./InitializeGovernedUpgradeabilityProxy.sol";

contract UpgradeableBeacon is InitializeGovernedUpgradeabilityProxy {
    bytes32 internal constant BEACON_IMPLEMENTATION_SLOT =
        0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50;

    function initialize(
        address _logic,
        address _beacon,
        address _initGovernor,
        bytes calldata _data
    ) public payable onlyGovernor {
        require(_beaconImplementation() == address(0));
        require(_beacon != address(0), "Beacon not set");
        assert(
            BEACON_IMPLEMENTATION_SLOT ==
                bytes32(uint256(keccak256("eip1967.proxy.beacon")) - 1)
        );
        _setBeaconImplementation(_beacon);

        initialize(_logic, _initGovernor, _data);
    }

    function beaconImplementation() external view returns (address) {
        return _beaconImplementation();
    }

    function _beaconImplementation() internal view returns (address impl) {
        bytes32 slot = BEACON_IMPLEMENTATION_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            impl := sload(slot)
        }
    }

    function setBeaconImplementation(address newImplementation)
        public
        onlyGovernor
    {
        _setBeaconImplementation(newImplementation);
    }

    function _setBeaconImplementation(address newImplementation) internal {
        require(
            Address.isContract(newImplementation),
            "Cannot set a proxy implementation to a non-contract address"
        );

        bytes32 slot = BEACON_IMPLEMENTATION_SLOT;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, newImplementation)
        }

        emit Upgraded(newImplementation);
    }
}
