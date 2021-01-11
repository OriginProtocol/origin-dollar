pragma solidity 0.5.11;
import "../../contracts/contracts/token/OUSD.sol";

contract OUSDHarness is OUSD {
	function Certora_maxSupply() external view returns (uint) { return MAX_SUPPLY; }
	function Certora_isNonRebasingAccount(address account) external returns (bool) { return _isNonRebasingAccount(account); }


	function init_state() external { 
		rebasingCreditsPerToken = 1e18; // TODO: Guarantee this is updated
	}

	// overrides to simplify the ratios
	function _creditsPerToken(address _account)
		internal
		//override // only if we move to solc6
		view
		returns (uint256)
	{
		return 1e18;
	}

	// function rebasingCreditsPerToken() public view returns (uint256) { return 1e18; }
}