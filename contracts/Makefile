-include .env

.EXPORT_ALL_VARIABLES:
MAKEFLAGS += --no-print-directory

# ANSI Colors
RESET=\033[0m

BLACK=\033[0;30m
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
MAGENTA=\033[0;35m
CYAN=\033[0;36m
WHITE=\033[0;37m

# Bold colors
BOLD_BLACK=\033[1;30m
BOLD_RED=\033[1;31m
BOLD_GREEN=\033[1;32m
BOLD_YELLOW=\033[1;33m
BOLD_BLUE=\033[1;34m
BOLD_MAGENTA=\033[1;35m
BOLD_CYAN=\033[1;36m
BOLD_WHITE=\033[1;37m

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
	@echo "$(BOLD_BLUE)Running script RunlogsDATE=$(DATE)_CHAIN=$(CHAIN) $(RESET) \n"
	forge script Runlogs_$(DATE)_$(CHAIN) -vvvvv
	@echo "$(BOLD_BLUE)\nConverting foundry broadcast messages to Safe format... $(RESET) \n"
	forge script BroadcastConvertor contracts/broadcast/$(DATE).s.sol/$(CHAIN_ID)/dry-run/

.PHONY: script