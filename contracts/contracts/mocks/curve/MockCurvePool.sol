pragma solidity 0.5.11;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";
import { ICurvePool } from "../../strategies/ICurvePool.sol";
import { StableMath } from "../../utils/StableMath.sol";
import "../../utils/Helpers.sol";

interface IMintableBurnableERC20 {
    function mint(uint256 value) external returns (bool);

    function burn(uint256 value) external returns (bool);
}

contract MockCurvePool is ERC20 {
    using StableMath for uint256;

    address[] public coins;
    address lpToken;

    constructor(address[3] memory _coins, address _lpToken) public {
        coins = _coins;
        lpToken = _lpToken;
    }

    // Returns the same amount of LP tokens in 1e18 decimals
    function add_liquidity(uint256[3] calldata _amounts, uint256 _minAmount)
        external
    {
        uint256 sum = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            if (_amounts[i] > 0) {
                IERC20(coins[i]).transferFrom(
                    msg.sender,
                    address(this),
                    _amounts[i]
                );
                // Burn whatever was transferred
                IMintableBurnableERC20(coins[i]).burn(_amounts[i]);
                uint256 assetDecimals = Helpers.getDecimals(coins[i]);
                // Convert to 1e18 and add to sum
                sum += _amounts[i].scaleBy(int8(18 - assetDecimals));
            }
        }
        // Assuming a naive implementation where the deposited amounts get split
        // equally among 3 coins
        // Mint 1/3 of sum of each coin for redeems
        for (uint256 i = 0; i < _amounts.length; i++) {
            uint256 assetDecimals = Helpers.getDecimals(coins[i]);
            // Mint 1/3
            IMintableBurnableERC20(coins[i]).mint(
                sum.div(3).scaleBy(int8(18 - assetDecimals))
            );
        }
        // Hacky way of simulating slippage to check _minAmount
        if (sum == 29000e18) sum = 14500e18;
        require(sum >= _minAmount, "Slippage ruined your day");
        // Send LP token to sender, e.g. 3CRV
        IMintableERC20(lpToken).mint(sum);
        IERC20(lpToken).transfer(msg.sender, sum);
    }

    // Dumb implementation that returns the same amount
    function calc_withdraw_one_coin(uint256 _amount, int128 _index)
        public
        view
        returns (uint256)
    {
        uint256 assetDecimals = Helpers.getDecimals(coins[uint256(_index)]);
        return _amount.scaleBy(int8(assetDecimals - 18));
    }

    function remove_liquidity_one_coin(
        uint256 _amount,
        int128 _index,
        uint256 _minAmount
    ) external {
        IERC20(lpToken).transferFrom(msg.sender, address(this), _amount);
        uint256[] memory amounts = new uint256[](coins.length);
        amounts[uint256(_index)] = _amount;
        uint256 amount = calc_withdraw_one_coin(_amount, _index);
        IERC20(coins[uint256(_index)]).transfer(msg.sender, amount);
    }

    function get_virtual_price() external view returns (uint256) {
        return 1 * 10**18;
    }
}
