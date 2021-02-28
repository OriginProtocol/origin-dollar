BASE=${1}
RULE=${2}
sed "s/VAULT_BASE/${BASE}/g" ../spec/harnesses/VaultHarnessTemplate.sol > VaultHarness.sol
# Use either Vault or VaultAdmin
certoraRun VaultHarness.sol \
  ../spec/harnesses/DummyERC20A.sol ../spec/harnesses/DummyERC20B.sol \
  contracts/mocks/MockCToken.sol contracts/mocks/MockAave.sol:MockAToken \
  ../spec/harnesses/SimpleStrategy.sol \
  --verify VaultHarness:../spec/vault.spec \
  --cache vault \
  --solc solc5.11 \
  --settings -assumeUnwindCond,-b=2,-t=300,-enableStorageAnalysis=true,-ignoreViewFunctions \
  --rule ${RULE} \
  --msg "Vault - ${BASE} verification"