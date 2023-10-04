// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MocksfrxETH is MintableERC20 {
    address public frxETH;
    address public sfrxETH;
    mapping(address => uint256) public assetBalance;

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

        assetBalance[receiver] += assets;

        _mint(receiver, assets);

        return assets;
    }

    function maxWithdraw(address owner) external view returns (uint256) {
        return assetBalance[owner];
    }

    function setMaxWithdrawableBalance(address owner, uint256 balance)
        external
    {
        assetBalance[owner] = balance;
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) external returns (uint256 assets) {
        assetBalance[owner] -= shares;

        ERC20(frxETH).transfer(receiver, shares);

        _burn(owner, shares);

        assets = shares;
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) external returns (uint256 shares) {
        assetBalance[owner] -= shares;

        ERC20(frxETH).transfer(receiver, shares);

        _burn(owner, shares);

        assets = shares;
    }

    function submitAndDeposit(address recipient)
        external
        payable
        returns (uint256 shares)
    {
        assetBalance[recipient] += msg.value;

        shares = msg.value;
    }
}
