import "./interfaces.sol";
import "../token/OUSD.sol";

contract PropertiesOUSDRebasing is CryticInterface, OUSD {
  function echidna_check_balance_stable() public returns (bool) {
    return initialBalance_user == this.balanceOf(crytic_user);
  }
}
