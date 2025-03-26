// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

interface ICurveMinter {
    event Minted(address indexed recipient, address gauge, uint256 minted);

    function allowed_to_mint_for(address arg0, address arg1)
        external
        view
        returns (bool);

    function controller() external view returns (address);

    function mint(address gauge_addr) external;

    function mint_for(address gauge_addr, address _for) external;

    function mint_many(address[8] memory gauge_addrs) external;

    function minted(address arg0, address arg1) external view returns (uint256);

    function toggle_approve_mint(address minting_user) external;

    function token() external view returns (address);
}
