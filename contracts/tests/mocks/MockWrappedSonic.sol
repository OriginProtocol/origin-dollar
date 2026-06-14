// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../contracts/mocks/MintableERC20.sol";

contract MockWrappedSonic is MintableERC20 {
    constructor() ERC20("Wrapped Sonic", "wS") {}

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        (bool sent,) = payable(msg.sender).call{value: wad}("");
        require(sent, "S transfer failed");
    }

    function depositFor(address account) external payable returns (bool) {
        _mint(account, msg.value);
        return true;
    }

    function withdrawTo(address account, uint256 value) external returns (bool) {
        _burn(msg.sender, value);
        (bool sent,) = payable(account).call{value: value}("");
        require(sent, "S transfer failed");
        return true;
    }
}
