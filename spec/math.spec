/**

RCPT = RC / (T - NR)
T' = RC / RCPT + NR

Can T' > T?

mathematically T ' = RC /(RC/(T-NR)) + NR = T-NR + NR = T 
but:
x/y is actually x*1e18 // y

**/

definition divPrecisely(uint x, uint y) returns mathint 
	= x*1000000000000000000 / y ;

definition MAX_UINT256() returns uint 
	= 115792089237316195423570985008687907853269984665640564039457584007913129639935 ;

definition MAX_SUPPLY() returns uint
	= 340282366920938463463374607431768211455 ; // 2^128 - 1

// seems also to show that 3.2 in the doc is violated
rule mathOfChangeSupply(uint T, uint NR, uint RC) {
	require T <= MAX_SUPPLY();
	require T > 0 && NR > 0 && T > NR;
	require RC > 0; // is this reasonable?
	
	mathint RCPT = divPrecisely(RC, (T - NR));
	require RCPT <= MAX_UINT256();
	
	mathint T2 = divPrecisely(RC, RCPT) + NR;
	
	assert T2 <= MAX_SUPPLY();
}

// T is for the provided supply
rule mathOfChangeSupply(uint T, uint NR, uint RC) {
	require T <= MAX_SUPPLY();
	require T > 0 && NR > 0 && T > NR;
	require RC > 0; // is this reasonable?
	
	mathint RCPT = divPrecisely(RC, (T - NR));
	require RCPT <= MAX_UINT256();
	
	mathint T2 = divPrecisely(RC, RCPT) + NR;
	
	assert T2 <= T || T2 == NR;
}

definition FULL_SCALE() returns uint
	= 1000000000000000000 ; // 1e18
	
	