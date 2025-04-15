from world_abstract import *

ws = load_contract('ws', WS_SONIC)
os = load_contract('ousd', OS)
wos = load_contract('ERC20', WOS)

vault_admin = load_contract('vault_admin', OS_VAULT_PROXY_ADDRESS)
vault_core = load_contract('vault_core', OS_VAULT_PROXY_ADDRESS)