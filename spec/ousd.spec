methods {
	totalSupply() returns uint256 envfree

	rebasingCreditsPerToken() returns uint256 envfree
	nonRebasingSupply() returns uint256 envfree
	rebasingCredits() returns uint256 envfree

	rebaseState(address) returns uint8 envfree

	// certora harnesses
	Certora_maxSupply() returns uint256 envfree

}

invariant totalSupplyIsBelowMaxSupply() 
	totalSupply() <= Certora_maxSupply()


rule neverRevert_BalanceOf {
	// probably must assume invariant rebasingCreditsPerTokenMustBeGreaterThan0
	env e;
	address who;
	invoke balanceOf(e, who);
	assert !lastReverted;
}

invariant rebasingCreditsPerTokenMustBeGreaterThan0() 
	rebasingCreditsPerToken() > 0
	
// a condition for changeSupply() not to revert:
invariant totalSupplyMustBeStrictlyGreaterThanNonRebasingSupply() 
	totalSupply() > nonRebasingSupply() // probably wrong in constructor/initialization?
	
// otherwise, totalSupply is 0.
invariant rebasingCreditsMustBeGreaterThan0()
		rebasingCredits() > 0  // probably wrong in constructor/initialization?


rule senderCannotDecreaseOthersBalance(address executor, address who, method f) {
	env eF;
	require eF.msg.sender == executor;
	require executor != who;
	// no approval from who to executor
	require allowance(who, executor) == 0;
	
	uint256 previous = balanceOf(who);
	
	calldataarg arg;
	sinvoke f(eF, arg);
	
	uint256 current = balanceOf(who);
	assert current >= previous;
}	

function executeAFunction(method f) {
	env e;
	calldataarg arg;
	sinvoke f(e, arg);
}

rule changesRebaseState(method f) {
	address who;
	
	uint8 _rebaseState = rebaseState(who);
	
	executeAFunction(f);
	
	uint8 rebaseState_ = rebaseState(who);
	assert _rebaseState == rebaseState_;
}

rule changesBalanceForNonRebasing(method f) {
	address who;
	require _isNonRebasingAccount(who);
	
	_b = balanceOf(who);
	
	executeAFunction(f);
	
	b_ = balanceOf(who);
	assert _b == b_; // expecting only the transfer functions to affect the balance.
}