Scripts for OUSD governance.

The lifecycle of a governance proposal is as follow:
  1. A proposal for executing some action(s) is submitted by calling the propose(args) method on the governor contract. A proposalId is returned. Anyone can submit a proposal.
  1. After it is reviewed and if approved, the proposal gets queued by calling the queue(proposalId) method on the governor contract. Only the guardian (currently Origin's multisig) can do so.
  1. After the timelock on the proposal expires, the proposal can be executed by calling the method execute(proposalId) on the governor contract. Only the guardian can do so.
  
