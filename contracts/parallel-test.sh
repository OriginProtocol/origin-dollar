#!/bin/bash

main()
{
  echo "For chunk: $CHUNK_ID"
  IFS=$'\n' read -r -d '' -a testfiles < <(for filename in test/**/*.fork-test.js; do
    test_count=$(grep -o "it(" $filename | wc -w)
    echo "$filename $test_count"
  done | sort -k 2rn | sed 's/\.js[0-9 ]*$/\.js/')

  files_chunk=()

  for i in "${!testfiles[@]}"; do
    if [ "$(($i%3))" == "$CHUNK_ID" ]; then
      files_chunk+=("${testfiles[$i]}")
    fi
  done

  ./fork-test.sh "${files_chunk[@]}"
}

main "$@"
