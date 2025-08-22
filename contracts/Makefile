-include .env

.EXPORT_ALL_VARIABLES:
MAKEFLAGS += --no-print-directory

DATE ?= $(shell date +%Y_%m)
CHAIN ?= Mainnet

VALID_CHAINS = Mainnet Base Sonic Plume Arbitrum Holesky
MAINNET_ID = 1
BASE_ID = 8453
SONIC_ID = 146
PLUME_ID = 98865
ARBITRUM_ID = 42161
HOLESKY_ID = 17000

define get_chain_id
$(if $(filter $(CHAIN),$(VALID_CHAINS)),\
$(if $(filter Mainnet,$(CHAIN)),$(MAINNET_ID),\
$(if $(filter Base,$(CHAIN)),$(BASE_ID),\
$(if $(filter Sonic,$(CHAIN)),$(SONIC_ID),\
$(if $(filter Plume,$(CHAIN)),$(PLUME_ID),\
$(if $(filter Arbitrum,$(CHAIN)),$(ARBITRUM_ID),\
$(HOLESKY_ID)))))),\
$(error CHAIN "$(CHAIN)" is not valid. Valid chains are: $(VALID_CHAINS)))
endef

script:
	$(eval CHAIN_ID := $(call get_chain_id))
	@echo "Running script RunlogsDATE=$(DATE)_CHAIN=$(CHAIN) \n"
	forge script Runlogs_$(DATE)_$(CHAIN)
	python3 scripts/runlogs/broadcast_convertor.py -i broadcast/$(DATE).s.sol/$(CHAIN_ID)/dry-run/run-latest.json -d True

.PHONY: script