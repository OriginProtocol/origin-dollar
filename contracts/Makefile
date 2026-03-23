-include .env

.EXPORT_ALL_VARIABLES:
MAKEFLAGS += --no-print-directory

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                 VARIABLES                                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

DEPLOY_SCRIPT   := scripts/deploy/DeployManager.s.sol
DEPLOY_BASE     := --account deployerKey --sender $(DEPLOYER_ADDRESS) --broadcast --slow

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  DEFAULT                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

default:
	forge fmt
	forge build

install:
	foundryup --version stable
	forge soldeer install
	./install-deps.sh
	pnpm i

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                   CLEAN                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

clean:
	rm -rf broadcast cache out
	find build -name '*fork*' -delete 2>/dev/null || true
	rm -f deployments-fork-*.json

clean-all: clean
	rm -rf dependencies node_modules soldeer.lock lcov.info coverage

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                   TESTS                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Base test command
test-base:
	forge test --summary --fail-fast --show-progress -vvv

# Run all tests
test:
	$(MAKE) test-base

# Run tests matching a function name: make test-f-testSwap
test-f-%:
	FOUNDRY_MATCH_TEST=$* $(MAKE) test-base

# Run tests matching a contract name: make test-c-OETHVault
test-c-%:
	FOUNDRY_MATCH_CONTRACT=$* $(MAKE) test-base

# Run tests by category
test-unit:
	FOUNDRY_MATCH_PATH='tests/unit/**' $(MAKE) test-base

test-fork:
	FOUNDRY_MATCH_PATH='tests/fork/**' $(MAKE) test-base

test-fork-mainnet:
	FOUNDRY_MATCH_PATH='tests/fork/mainnet/**' $(MAKE) test-base

test-fork-base:
	FOUNDRY_MATCH_PATH='tests/fork/base/**' $(MAKE) test-base

test-fork-sonic:
	FOUNDRY_MATCH_PATH='tests/fork/sonic/**' $(MAKE) test-base

test-fork-hyperevm:
	FOUNDRY_MATCH_PATH='tests/fork/hyperevm/**' $(MAKE) test-base

test-smoke:
	forge build
	FOUNDRY_MATCH_PATH='tests/smoke/**' $(MAKE) test-base

test-smoke-mainnet:
	forge build
	FOUNDRY_MATCH_PATH='tests/smoke/mainnet/**' $(MAKE) test-base

test-smoke-base:
	forge build
	FOUNDRY_MATCH_PATH='tests/smoke/base/**' $(MAKE) test-base

test-smoke-sonic:
	forge build
	FOUNDRY_MATCH_PATH='tests/smoke/sonic/**' $(MAKE) test-base

test-smoke-hyperevm:
	forge build
	FOUNDRY_MATCH_PATH='tests/smoke/hyperevm/**' $(MAKE) test-base

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                 COVERAGE                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

coverage:
	forge coverage --report lcov

coverage-html: coverage
	genhtml ./lcov.info -o coverage --branch-coverage

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                   GAS                                        ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

gas:
	forge test --gas-report

snapshot:
	forge snapshot

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  DEPLOY                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

deploy-mainnet:
	forge build
	@forge script $(DEPLOY_SCRIPT) --rpc-url $(MAINNET_PROVIDER_URL) $(DEPLOY_BASE) --verify -vvvv

deploy-base:
	forge build
	@forge script $(DEPLOY_SCRIPT) --rpc-url $(BASE_PROVIDER_URL) $(DEPLOY_BASE) --verify -vvvv

deploy-sonic:
	forge build
	@forge script $(DEPLOY_SCRIPT) --rpc-url $(SONIC_PROVIDER_URL) $(DEPLOY_BASE) --verify -vvv

deploy-hyperevm:
	forge build
	@forge script $(DEPLOY_SCRIPT) --rpc-url $(HYPEREVM_PROVIDER_URL) $(DEPLOY_BASE) --verify -vvvv

deploy-local:
	forge build
	@forge script $(DEPLOY_SCRIPT) --rpc-url $(LOCAL_URL) $(DEPLOY_BASE) -vvvv

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                 SIMULATE                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Simulate deployment: make simulate (mainnet) or make simulate NETWORK=sonic
NETWORK ?= mainnet
RPC_URL = $(if $(filter sonic,$(NETWORK)),$(SONIC_PROVIDER_URL),$(if $(filter base,$(NETWORK)),$(BASE_PROVIDER_URL),$(if $(filter hyperevm,$(NETWORK)),$(HYPEREVM_PROVIDER_URL),$(MAINNET_PROVIDER_URL))))

simulate:
	forge build
	@forge script $(DEPLOY_SCRIPT) --fork-url $(RPC_URL) -vvvv

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                            UPDATE DEPLOYMENTS                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# TODO: Not ready yet — needs UpdateGovernanceMetadata.s.sol script
# update-deployments:
# 	forge build
# 	@forge script scripts/automation/UpdateGovernanceMetadata.s.sol --fork-url $(MAINNET_PROVIDER_URL) -vvvv

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  VERIFY                                      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Compare local contract with deployed bytecode
# Usage: make match file=contracts/vault/VaultCore.sol addr=0xCED...
SHELL := /bin/bash
match:
	@if [ -z "$(file)" ] || [ -z "$(addr)" ]; then \
		echo "Usage: make match file=<path> addr=<address>"; \
		exit 1; \
	fi
	@name=$$(basename $(file) .sol); \
	diff <(forge flatten $(file)) <(cast source --flatten $(addr)) \
	&& printf "✅ Success: Local contract %-20s matches deployment at $(addr)\n" "$$name" \
	|| printf "❌ Failure: Local contract %-20s differs from deployment at $(addr)\n" "$$name"

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  UTILS                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# Print a frame with centered text: make frame text="SECTION NAME"
frame:
	@if [ -z "$(text)" ]; then echo "Usage: make frame text=\"SECTION NAME\""; exit 1; fi
	@awk -v t="$(text)" 'BEGIN { \
		w=78; \
		printf "// ╔"; for(i=0;i<w;i++) printf "═"; print "╗"; \
		pad=int((w-length(t))/2); \
		printf "// ║"; for(i=0;i<pad;i++) printf " "; printf "%s", t; \
		for(i=0;i<w-pad-length(t);i++) printf " "; print "║"; \
		printf "// ╚"; for(i=0;i<w;i++) printf "═"; print "╝"; \
	}'

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║                                  PHONY                                       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

.PHONY: test test-base test-unit test-fork test-fork-mainnet test-fork-base \
        test-fork-sonic test-fork-hyperevm test-smoke test-smoke-mainnet \
        test-smoke-base test-smoke-sonic test-smoke-hyperevm \
        coverage coverage-html gas snapshot \
        deploy-mainnet deploy-base deploy-sonic deploy-hyperevm deploy-local simulate \
        match clean clean-all install frame
