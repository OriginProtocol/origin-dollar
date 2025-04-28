// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { AccessControlEnumerable } from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";

contract BridgedWOETH is
    Governable,
    AccessControlEnumerable,
    Initializable,
    ERC20
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("Wrapped OETH", "wOETH") {
        // Nobody owns the implementation
        _setGovernor(address(0));
    }

    /**
     * @dev Initialize the proxy and set the Governor
     */
    function initialize() external initializer {
        // Governor can grant Minter/Burner roles
        _setupRole(DEFAULT_ADMIN_ROLE, _governor());
    }

    /**
     * @dev Mint tokens for `account`
     * @param account Address to mint tokens for
     * @param amount Amount of tokens to mint
     */
    function mint(address account, uint256 amount)
        external
        onlyRole(MINTER_ROLE)
        nonReentrant
    {
        _mint(account, amount);
    }

    /**
     * @dev Burns tokens from `account`
     * @param account Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burn(address account, uint256 amount)
        external
        onlyRole(BURNER_ROLE)
        nonReentrant
    {
        _burn(account, amount);
    }

    /**
     * @dev Burns tokens from `msg.sender`
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external onlyRole(BURNER_ROLE) nonReentrant {
        _burn(msg.sender, amount);
    }

    /**
     * @dev Returns the name of the token.
     */
    function name() public view virtual override returns (string memory) {
        return "Wrapped OETH";
    }

    /**
     * @dev Returns the symbol of the token, usually a shorter version of the
     * name.
     */
    function symbol() public view virtual override returns (string memory) {
        return "wOETH";
    }

    /**
     * @dev Returns the decimals of the token
     */
    function decimals() public view virtual override returns (uint8) {
        return 18;
    }
}
