certoraRun contracts/token/OUSD.sol \
	--verify OUSD:../spec/PrivilegedOUSD.spec \
	--settings -t=300,-ignoreViewFunctions \
	--msg "OUSD Privileged"