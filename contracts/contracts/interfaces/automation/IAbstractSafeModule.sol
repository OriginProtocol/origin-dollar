// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAbstractSafeModule {
    function safeContract() external view returns (address);

    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);

    function OPERATOR_ROLE() external view returns (bytes32);

    function hasRole(bytes32 role, address account)
        external
        view
        returns (bool);

    function getRoleMember(bytes32 role, uint256 index)
        external
        view
        returns (address);

    function getRoleMemberCount(bytes32 role) external view returns (uint256);

    function grantRole(bytes32 role, address account) external;

    function transferTokens(address token, uint256 amount) external;
}
