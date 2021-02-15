methods {
	balanceOf(address) returns uint256 envfree
}

definition summedFunction(address u) returns uint256 = balanceOf(u);

rule changesOne(method f, address Addr1, address Addr2)
{
	env e;
	
	// Balances before
	uint256 _r1Balance = summedFunction(Addr1);
	uint256 _r2Balance = summedFunction(Addr2);
	
	require !(Addr1 == Addr2);
	
	calldataarg arg;
	sinvoke f(e, arg);
	
	// Balances after
	uint256 r1Balance_ = summedFunction(Addr1);
	uint256 r2Balance_ = summedFunction(Addr2);
		
	bool c1 = (_r1Balance!=r1Balance_);
	bool c2 = (_r2Balance!=r2Balance_);
	
	// helping variable
	bool changesAtLeastTwo = ( (c1 && c2) );
	
	// If true, it changes <= 1
	assert !changesAtLeastTwo, "Violated: changes less than or equal 1 violated.";

}

rule changesTwo(method f, address Addr1, address Addr2, address Addr3)
{
	env e;

	// Balances before
	uint256 _r1Balance = summedFunction(Addr1);
	uint256 _r2Balance = summedFunction(Addr2);
	uint256 _r3Balance = summedFunction(Addr3);
	
	// all the addresses should be different
	require !((Addr1 == Addr2) || ( Addr2 == Addr3) || ( Addr1 == Addr3) );
	
	calldataarg arg;
	sinvoke f(e, arg);
	
	// Balances after
	uint256 r1Balance_ = summedFunction(Addr1);
	uint256 r2Balance_ = summedFunction(Addr2);
	uint256 r3Balance_ = summedFunction(Addr3);	
	
	bool c1 = (_r1Balance!=r1Balance_);
	bool c2 = (_r2Balance!=r2Balance_);
	bool c3 = (_r3Balance!=r3Balance_);
	
	// helping variable
	bool changesAtLeastThree = ( (c1 && c2 && c3) );
	
	// If true, it changes <= 2
	assert !changesAtLeastThree, "Violated: changes less than or equal 2 violated.";
	
}

rule sum1Test(method f, address Addr1){
	env e;
	
	// Balances before
	uint256 _r1Balance = summedFunction(Addr1);
	
	calldataarg arg;
	sinvoke f(e, arg);
	
	// Balances after
	uint256 r1Balance_ = summedFunction(Addr1);
	
	bool c1 = (_r1Balance!=r1Balance_);
	
	// Function will check only the address which balance was changed
	require c1;
	
	// after
	assert _r1Balance == r1Balance_, "Violated: sum of one returns false.";
}

rule sum2Test(method f, address Addr1, address Addr2){
	env e;
	
	// Adderesses should be different
	require Addr1 != Addr2;
		
	// Balances before
	uint256 _r1Balance = summedFunction(Addr1);
	uint256 _r2Balance = summedFunction(Addr2);

	mathint _sumB = _r1Balance + _r2Balance;
	
	calldataarg arg;
	sinvoke f(e, arg);
	
	// Balances after
	uint256 r1Balance_ = summedFunction(Addr1);
	uint256 r2Balance_ = summedFunction(Addr2);
	
	mathint sumB_ = r1Balance_ + r2Balance_;
	
	bool c1 = (_r1Balance!=r1Balance_);
	bool c2 = (_r2Balance!=r2Balance_);
	
	// Function will check only the two addresses which balances were changed
	require c1 && c2;
	
	// after
	assert _r1Balance + _r2Balance == r1Balance_ + r2Balance_, "Violated: sum of two returns false.";
}	