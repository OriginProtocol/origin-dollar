If you made a contract change, make sure to complete the checklist below before merging it in master.

Refer to our [documentation](https://github.com/OriginProtocol/security) for more details about contract security best practices.

Contract change checklist:
  - [ ] Code reviewed by 2 reviewers. 
  - [ ] Copy & paste code review [security checklist](https://github.com/OriginProtocol/security/blob/master/templates/Contract-Code-Review-Example.md) below this checklist.
  - [ ] Unit tests pass
  - [ ] Slither tests pass with no warning
  - [ ] Echidna tests pass if PR includes changes to OUSD contract (not automated, run manually on local)
