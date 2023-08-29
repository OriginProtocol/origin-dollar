from world import *
import requests
from types import SimpleNamespace

def get_1inch_swap_data(from_token, to_token, swap_amount, slippage, from_address=STRATEGIST, to_address=STRATEGIST):
  req = requests.get('https://api.1inch.io/v5.0/1/swap', params={
    'fromTokenAddress': from_token,
    'fromAddress': from_address,
    'destReceiver': to_address,
    'toTokenAddress': to_token,
    'amount': str(swap_amount),
    'allowPartialFill': True,
    'disableEstimate': 'true',
    'slippage': slippage
  }, headers={
    'accept': 'application/json'
  })

  if req.status_code != 200:
    print(req.json())
    raise Exception("Error calling 1inch api")

  result = req.json()

  return SimpleNamespace(receiver = result['tx']['to'], input = result['tx']['data'])
