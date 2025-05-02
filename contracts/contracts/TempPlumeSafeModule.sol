// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface ISafe {
    function disableModule(address, address) external;

    function execTransactionFromModule(
        address,
        uint256,
        bytes memory,
        uint8
    ) external returns (bool);
}

contract TempPlumeSafeModule {
    address public constant TREASURY =
        0x6E3fddab68Bf1EBaf9daCF9F7907c7Bc0951D1dc;
    address public constant DEFAULT_SINGLETON =
        0xfb1bffC9d739B8D520DaF37dF666da4C687191EA;

    // Slot 0
    address public singleton;

    function fixSingleton() external {
        singleton = DEFAULT_SINGLETON;
    }

    function execFixSingleton() external {
        ISafe(TREASURY).execTransactionFromModule(
            address(this),
            0, // Value
            abi.encodeWithSelector(bytes4(keccak256("fixSingleton()"))),
            1 // Delegatecall
        );

        // Disable the module
        ISafe(TREASURY).execTransactionFromModule(
            TREASURY,
            0, // Value
            abi.encodeWithSelector(
                bytes4(keccak256("disableModule(address,address)")),
                address(0x1),
                address(this)
            ),
            1 // Delegatecall
        );
    }
}
