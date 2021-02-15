P=${1}
SRC=${2}
# vault Vault
# vault VaultCore
sed "s/PATH/${P}/g; s/SRC/${SRC}/g" ../spec/harnesses/ReentrancyHarnessTemplate.sol > ReentrancyHarness.sol
certoraRun.py ReentrancyHarness.sol --verify ReentrancyHarness:../spec/reentrancyVault.spec \
  --solc solc5.11 \
  --cache reentrancy \
  --settings -assumeUnwindCond,-b=2,-t=300 \
  --cloud --msg "reentrancy - ${SRC}"