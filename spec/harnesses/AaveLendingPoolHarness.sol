import { IAaveLendingPool } from "../../contracts/contracts/strategies/IAave.sol";

interface MintableERC20 {
    function mint(address, uint) external;
    function transferFrom(address,address,uint) external;

}

contract AaveLendingPoolHarness is IAaveLendingPool {

    mapping(address => address) public reserveToAToken;
    
    // reserve is asset. transfer from asset to here, mint new atokens. For simplicity, exchange rate is 1.
    function deposit(
        address _reserve,
        uint256 _amount,
        uint16 _referralCode
    ) external {
        address aToken = reserveToAToken[_reserve];
        MintableERC20(_reserve).transferFrom(msg.sender, address(this), _amount);
        MintableERC20(aToken).mint(msg.sender, _amount);
    }
    
}