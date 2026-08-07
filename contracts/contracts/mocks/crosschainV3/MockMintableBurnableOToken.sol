// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockMintableBurnableOToken
 * @notice TEST-ONLY OToken stand-in for the V3 strategy unit tests. Mirrors the
 *         vault-restricted mint / burn surface of the real OUSD / OETH tokens
 *         without any rebasing or share-credit machinery.
 */
contract MockMintableBurnableOToken is ERC20 {
    address public immutable vaultAddress;

    constructor(
        string memory name_,
        string memory symbol_,
        address _vault
    ) ERC20(name_, symbol_) {
        require(_vault != address(0), "MockOToken: vault required");
        vaultAddress = _vault;
    }

    modifier onlyVault() {
        require(msg.sender == vaultAddress, "MockOToken: only vault");
        _;
    }

    function mint(address _to, uint256 _amount) external onlyVault {
        _mint(_to, _amount);
    }

    function burn(address _from, uint256 _amount) external onlyVault {
        _burn(_from, _amount);
    }
}
