#!/bin/bash

slither . \
    --exclude-dependencies \
    --exclude conformance-to-solidity-naming-conventions,different-pragma-directives-are-used \
    --filter-paths=@openzeppelin
