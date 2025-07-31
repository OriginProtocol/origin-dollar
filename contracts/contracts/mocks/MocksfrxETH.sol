// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MocksfrxETH is MintableERC20 {
    address public frxETH;

    constructor(address _frxETH) ERC20("sfrxETH", "sfrxETH") {
        frxETH = _frxETH;
    }

    function setMockfrxETHAddress(address _frxETH) external {
        frxETH = _frxETH;
    }

    function deposit(uint256 assets, address receiver)
        external
        returns (uint256 shares)
    {
        ERC20(frxETH).transferFrom(msg.sender, address(this), assets);

        _mint(receiver, assets);

        return assets;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function setMaxWithdrawableBalance(address owner, uint256 balance)
        external
    {
        uint256 currentBalance = balanceOf(owner);
        if (currentBalance > balance) {
            _burn(owner, currentBalance - balance);
        } else if (balance > currentBalance) {
            _mint(owner, balance - currentBalance);
        }
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        _burn(owner, shares);

        ERC20(frxETH).transfer(receiver, shares);

        assets = shares;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        _burn(owner, assets);

        ERC20(frxETH).transfer(receiver, assets);

        shares = assets;
    }

    function submitAndDeposit(address recipient)
        external
        payable
        returns (uint256 shares)
    {
        _mint(recipient, msg.value);
        shares = msg.value;
    }
}
