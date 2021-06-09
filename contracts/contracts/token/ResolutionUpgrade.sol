pragma solidity 0.5.11;

import { OUSD } from "./OUSD.sol";

contract OUSDResolutionUpgrade is OUSD {
    uint256 private constant RESOLUTION_INCREASE = 1e9;

    function upgradeGlobals() external {
        require(isUpgraded[address(0)] == 0);
        isUpgraded[address(0)] = 1;
        rebasingCredits *= RESOLUTION_INCREASE;
        rebasingCreditsPerToken *= RESOLUTION_INCREASE;
    }

    function upgradeAccounts(address[] calldata accounts) external {
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(isUpgraded[account] == 0);
            isUpgraded[account] = 1;

            _creditBalances[account] *= RESOLUTION_INCREASE;
            uint256 nrc = nonRebasingCreditsPerToken[account];
            if (nrc > 0) {
                nonRebasingCreditsPerToken[account] = nrc * RESOLUTION_INCREASE;
            }
        }
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(false, "upgrading");
    }

    function transferFrom(address _to, uint256 _value) public returns (bool) {
        require(false, "upgrading");
    }

    function mint(address _account, uint256 _amount) external {
        require(false, "upgrading");
    }

    function burn(address account, uint256 amount) external {
        require(false, "upgrading");
    }

    function rebaseOptIn() public {
        require(false, "upgrading");
    }

    function rebaseOptOut() public {
        require(false, "upgrading");
    }

    function changeSupply(uint256 _newTotalSupply) external {
        require(false, "upgrading");
    }

    function balanceOf(address _account) public view returns (uint256) {
        require(false, "upgrading");
    }

    function creditsBalanceOf(address _account)
        public
        view
        returns (uint256, uint256)
    {
        require(false, "upgrading");
    }
}
