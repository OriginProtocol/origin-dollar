strategy=${1}
certoraRun contracts/strategies/${strategy}.sol \
	--verify ${strategy}:../spec/PrivilegedStrategy.spec \
	--settings -t=300,-ignoreViewFunctions,-assumeUnwindCond \
	--msg "Strategy ${strategy} Privileged"