rule privilegedOperation(method f, address privileged1, address privileged2)
description "$f can be called by more than two users without reverting"
{
    require privileged1 != privileged2;
	env e1;
	calldataarg arg;
	require e1.msg.sender == privileged1;

	storage initialStorage = lastStorage;
	invoke f(e1, arg); // privileged succeeds executing candidate privileged operation.
	bool firstSucceeded = !lastReverted;

    env e2;
	calldataarg arg2;
	require e2.msg.sender == privileged2;
    invoke f(e2, arg) at initialStorage; // privileged succeeds executing candidate privileged operation.
	bool secondSucceeded = !lastReverted;

	env e3;
	calldataarg arg3;
	require e3.msg.sender != privileged1 && e3.msg.sender != privileged2;
	invoke f(e3, arg3) at initialStorage; // unprivileged
	bool thirdSucceeded = !lastReverted;

	assert  !(firstSucceeded && secondSucceeded && thirdSucceeded), "${f.selector} can be called by both ${e1.msg.sender}, ${e2.msg.sender}, and ${e3.msg.sender}, so it is not privileged";
}
