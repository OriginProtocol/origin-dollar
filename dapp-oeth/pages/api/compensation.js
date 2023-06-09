import accountsToBeCompensated from 'constants/merkleProofedAccountsToBeCompensated.json'

export default function handler(req, res) {
  res.statusCode = 200
  const requestedAccount = accountsToBeCompensated[req.query.wallet]
  res.setHeader('Content-Type', 'application/json')
  if (requestedAccount) {
    res.end(JSON.stringify({ success: true, account: requestedAccount }))
  } else {
    res.status(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  }
}
