## Code Change Checklist

To be completed before internal review begins:

- [ ]  The contract code is complete
- [ ]  Executable deployment file
- [ ]  Fork tests that test after the deployment file runs
- [ ]  Unit tests *if needed
- [ ]  The owner has done a [full checklist review](https://github.com/OriginProtocol/security/blob/master/templates/Contract-Code-Review.md) of the code + tests

Internal review:

- [ ] Two approvals by internal reviewers


## Deploy checklist

Two reviewers complete the following checklist:

```
- [ ] All deployed contracts are listed in the deploy PR's description
- [ ] Deployed contract's verified code (and all dependencies) match the code in master
- [ ] Contract constructors have correct arguments
- [ ] The transactions that interacted with the newly deployed contract match the deploy script.
- [ ] Governance proposal matches the deploy script
- [ ] Smoke tests pass after fork test execution of the governance proposal
```

