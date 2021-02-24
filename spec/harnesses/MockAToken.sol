pragma solidity 0.5.11;

import {
    IAaveAToken,
    IAaveLendingPool,
    ILendingPoolAddressesProvider
} from "../../contracts/contracts/strategies/IAave.sol";
import { StableMath } from "../../contracts/contracts/utils/StableMath.sol";
import { SafeERC20 } from "../../contracts/node_modules/@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {
    IERC20,
    ERC20,
    ERC20Mintable
} from "../../contracts/node_modules/@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import {
    ERC20Detailed
} from "../../contracts/node_modules/@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

// 1. User calls 'getLendingPool'
// 2. User calls 'deposit' (Aave)
//  - Deposit their underlying
//  - Mint aToken to them
// 3. User calls redeem (aToken)
//  - Retrieve their aToken
//  - Return equal amount of underlying

contract MockAToken is ERC20Mintable, ERC20Detailed {
    address public lendingPool;
    IERC20 public underlyingToken;
    using SafeERC20 for IERC20;

    constructor(
        address _lendingPool,
        string memory _name,
        string memory _symbol,
        IERC20 _underlyingToken
    )
        public
        ERC20Detailed(
            _name,
            _symbol,
            ERC20Detailed(address(_underlyingToken)).decimals()
        )
    {
        lendingPool = _lendingPool;
        underlyingToken = _underlyingToken;
        addMinter(_lendingPool);
    }

    function redeem(uint256 _amount) external {
        // Redeem these a Tokens
        _burn(msg.sender, _amount);
        // For the underlying
        underlyingToken.safeTransferFrom(lendingPool, msg.sender, _amount);
    }
}
