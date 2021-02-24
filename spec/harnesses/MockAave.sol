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

contract MockAave is IAaveLendingPool, ILendingPoolAddressesProvider {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    mapping(address => address) reserveToAToken;
    address pool = address(this);
    address payable core = address(uint160(address(this)));
    uint256 factor;

    function addAToken(address _aToken, address _underlying) public {
        IERC20(_underlying).safeApprove(_aToken, 0);
        IERC20(_underlying).safeApprove(_aToken, uint256(-1));
        reserveToAToken[_underlying] = _aToken;
    }

    // set the reserve factor / basically the interest on deposit
    // in 18 precision
    // so 0.5% would be 5 * 10 ^ 15
    function setFactor(uint256 factor_) public {
        factor = factor_;
    }

    function deposit(
        address _reserve,
        uint256 _amount,
        uint16 /*_referralCode*/
    ) external {
        uint256 previousBal = IERC20(reserveToAToken[_reserve]).balanceOf(
            msg.sender
        );
        uint256 interest = previousBal.mulTruncate(factor);
        ERC20Mintable(reserveToAToken[_reserve]).mint(msg.sender, interest);
        // Take their reserve
        IERC20(_reserve).safeTransferFrom(msg.sender, address(this), _amount);
        // Credit them with aToken
        ERC20Mintable(reserveToAToken[_reserve]).mint(msg.sender, _amount);
    }

    function getLendingPool() external view returns (address) {
        return pool;
    }

    function getLendingPoolCore() external view returns (address payable) {
        return core;
    }
}
