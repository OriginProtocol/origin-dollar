from world import *
import random

# Designed to be used on a fork test
wrapper = load_contract('wrapped_ousd', '0x1fDb67E186C6D955f26C5d706a0F3E0aa6d49333')


NUM_TESTS = 100
MAX_REBASE_INCREASE = 0.1

ALICE = "0x0a4c79ce84202b03e95b7a692e5d728d83c44c76"
ALLEN = "0x2b6ed29a95753c3ad948348e3e7b1a251080ffb9"
TWINS_A = [ALICE, ALLEN]

SARAH = "0x002e08000acbbae2155fab7ac01929564949070d"
SHAWN = "0x9845e1909dca337944a0272f1f9f7249833d2d19"
TWINS_B = [SARAH, SHAWN]

TWINS_C = [SARAH.replace('d','a'), SHAWN.replace('d','a')]

ALL_TWINS = [TWINS_A, TWINS_B, TWINS_C]

# Unlocks
unlock(BINANCE)
funder = load_contract("forcefund", "0x21a755560e746289b60b9db3237a556097de01f8")

unlock(vault_core.address)
funder.fund(vault_core, {'from': BINANCE, 'value': 1e18 })

for account in [ALICE, ALLEN, SARAH, SHAWN, TWINS_C[0], TWINS_C[1]]:
  unlock(account)
  funder.fund(account, {'from': BINANCE, 'value': 1e18 })
  ousd.approve(wrapper, 1e70, {'from': account})


def deposit_some(twins):
  wrap_twin, control_twin = twins
  amount = int(random.randint(0, 1e18)*random.randint(0, 1e9) + random.randint(0, 1e18))
  print("Depositing: %s {" % amount)
  ousd.mint(control_twin, amount, {'from': vault_core, 'gas_limit': 10000000, 'allow_revert': True})
  ousd.mint(wrap_twin, amount, {'from': vault_core, 'gas_limit': 10000000, 'allow_revert': True})
  print(ousd.balanceOf(wrap_twin))
  deposit_amount = min(amount, ousd.balanceOf(wrap_twin))
  wrapper.deposit(deposit_amount, wrap_twin, {'from': wrap_twin, 'gas_limit': 10000000, 'allow_revert': True})
  print("}")
  


def withdraw_some(twins):
  wrap_twin, control_twin = twins
  max_withdraw = wrapper.convertToAssets(wrapper.balanceOf(wrap_twin))
  amount = int(max_withdraw * random.random())
  amount = int(max(5, amount - random.randint(0, 1e18)))
  print("Withdrawing: %s {" % amount)
  wrapper.withdraw(amount, wrap_twin, wrap_twin, {'from': wrap_twin, 'gas_limit': 10000000, 'allow_revert': True})
  print("}")


def withdraw_all(twins):
  wrap_twin, control_twin = twins
  wrapper.redeem(wrapper.balanceOf(wrap_twin), wrap_twin, wrap_twin,{'from': wrap_twin})


def increase_supply():
  new_balance = int(ousd.totalSupply() * (random.random() * MAX_REBASE_INCREASE + 1.0))
  new_balance += random.randint(0, 1e18)
  print("Rebasing up %s OUSD" % c18(new_balance))
  ousd.changeSupply(int(new_balance), {'from': vault_core})

def print_balance_diffs(all_twins):
  diffs = []
  for twins in all_twins:
    control_balance = ousd.balanceOf(twins[1])
    wrapper_balance = wrapper.maxWithdraw(twins[0])+ousd.balanceOf(twins[0])
    diffs.append(str(wrapper_balance - control_balance))
  print("🧑‍🚒"," ".join(diffs))


# Run test

chain.snapshot()

deposit_some(TWINS_C)
deposit_some(TWINS_B)
deposit_some(TWINS_A)

for i in range(0, NUM_TESTS):
  print("------ %d ------" % i)
  twins = [TWINS_A, TWINS_B][random.randint(0,1)]
  if random.randint(0, 1) == 1:
    deposit_some(twins)
  else:
    withdraw_some(twins)
  print_balance_diffs(ALL_TWINS)
  print_balance_diffs(ALL_TWINS)
  increase_supply()
  print_balance_diffs(ALL_TWINS)
  print_balance_diffs(ALL_TWINS)

# After test

withdraw_all(TWINS_A)
withdraw_all(TWINS_B)
withdraw_all(TWINS_C)

print(ousd.balanceOf(TWINS_A[0]))
print(ousd.balanceOf(TWINS_A[1]))
print(ousd.balanceOf(TWINS_B[0]))
print(ousd.balanceOf(TWINS_B[1]))
print(ousd.balanceOf(TWINS_C[0]))
print(ousd.balanceOf(TWINS_C[1]))
