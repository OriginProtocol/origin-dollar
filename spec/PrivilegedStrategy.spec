methods {
    vaultAddress() returns address envfree
    governor() returns address envfree
}

// can be executed by both vault and governor
definition privilegedForBothVaultAndGovernor(method f) returns bool = false
    || f.selector == withdrawAll().selector
; 

rule privilegedOperation(method f, address privileged)
description "$f can be called by more than one user without reverting"
{
	env e1;
	calldataarg arg;
	require !privilegedForBothVaultAndGovernor(f);
	require e1.msg.sender == privileged;

	storage initialStorage = lastStorage;
	f@withrevert(e1, arg); // privileged succeeds executing candidate privileged operation.
	bool firstSucceeded = !lastReverted;

	env e2;
	calldataarg arg2;
	require e2.msg.sender != privileged;
	f@withrevert(e2, arg2) at initialStorage; // unprivileged
	bool secondSucceeded = !lastReverted;

	assert  !(firstSucceeded && secondSucceeded), "${f.selector} can be called by both ${e1.msg.sender} and ${e2.msg.sender}, so it is not privileged";
}

rule operationPrivilegedToVaultAndGovernor(method f) {
    env e;
    require privilegedForBothVaultAndGovernor(f);
    bool isPrivileged = e.msg.sender == governor() || e.msg.sender == vaultAddress();

    calldataarg arg;
    f@withrevert(e, arg);
    bool succeeded = !lastReverted;

    assert succeeded => isPrivileged;
}