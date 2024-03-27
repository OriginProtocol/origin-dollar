// SPDX-License-Identifier: MIT

/**
 * @title Mock Oracle
 * @author Rappie <rappie@perimetersec.io>
 */
contract MockOracle {
    mapping(address => uint256) public price;

    function setPrice(address asset, uint256 price_) external {
        price[asset] = price_;
    }
}
