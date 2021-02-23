strategy=${1}
rule=${2}
certoraRun contracts/strategies/${strategy}.sol ../spec/harnesses/DummyERC20A.sol \
  --staging \
  --verify ${strategy}:../spec/strategy.spec \
  --cache strategy \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=2,-t=300,-enableStorageAnalysis=true \
  --msg "Strategy ${strategy}-${rule} verification" \
  --rule ${rule}