pragma solidity 0.5.11;

import { IAaveLendingPool, ILendingPoolAddressesProvider } from "../strategies/IAave.sol";
import { StableMath } from "../utils/StableMath.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import { IERC20, ERC20, ERC20Mintable } from "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import { ERC20Detailed } from "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

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

    function poolRedeem(uint256 _amount, address _to) external {
        require(msg.sender == lendingPool, "pool only");
        // Redeem these a Tokens
        _burn(_to, _amount);
        // For the underlying
        underlyingToken.safeTransferFrom(lendingPool, _to, _amount);
    }
}

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
        address _to,
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
        ERC20Mintable(reserveToAToken[_reserve]).mint(_to, _amount);
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        MockAToken atoken = MockAToken(reserveToAToken[asset]);
        atoken.poolRedeem(amount, to);
        return amount;
    }

    function getLendingPool() external view returns (address) {
        return pool;
    }
}
