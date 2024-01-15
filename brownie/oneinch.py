from world import *
import requests
from types import SimpleNamespace
import os
import json
import time

ONEINCH_API_KEY = os.getenv('ONEINCH_API_KEY')

def get_1inch_quote(from_token, to_token, from_amount, retry_on_ratelimit=True):
  if len(ONEINCH_API_KEY) <= 0:
    raise Exception("Missing API key")
  res = requests.get('https://api.1inch.dev/swap/v5.2/1/quote', params={
    'src': from_token,
    'dst': to_token,
    'amount': "%.0f" % (from_amount)
  }, headers={
    'accept': 'application/json',
    'Authorization': 'Bearer {}'.format(ONEINCH_API_KEY)
  })

  if retry_on_ratelimit and res.status_code == 429:
    time.sleep(2) # Wait for 2s and then try again
    return get_1inch_quote(from_token, to_token, from_amount, False)
  elif res.status_code != 200:
    print(res.text)
    raise Exception("Error accessing 1inch api, expected status 200 received: ", res.status_code)

  result = json.loads(res.text)

  return int(result['toAmount'])

def get_1inch_swap_data(from_token, to_token, swap_amount, slippage, from_address=STRATEGIST, to_address=STRATEGIST, retry_on_ratelimit=True):
  if len(ONEINCH_API_KEY) <= 0:
    raise Exception("Missing API key")

  res = requests.get('https://api.1inch.dev/swap/v5.2/1/swap', params={
    'src': from_token,
    'fromAddress': from_address,
    'receiver': to_address,
    'dst': to_token,
    'amount': "%.0f" % (swap_amount),
    'allowPartialFill': True,
    'disableEstimate': 'true',
    'slippage': slippage
  }, headers={
    'accept': 'application/json',
    'Authorization': 'Bearer {}'.format(ONEINCH_API_KEY)
  })

  if retry_on_ratelimit and res.status_code == 429:
    time.sleep(2) # Wait for 2s and then try again
    return get_1inch_swap_data(from_token, to_token, swap_amount, slippage, from_address, to_address, False)
  elif res.status_code != 200:
    print(res.text)
    raise Exception("Error accessing 1inch api, expected status 200 received: ", res.status_code)

  result = json.loads(res.text)

  return SimpleNamespace(receiver = result['tx']['to'], input = result['tx']['data'])
