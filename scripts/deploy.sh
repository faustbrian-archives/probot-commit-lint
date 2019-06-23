#!/bin/sh
now="npx now --debug --token=$NOW_TOKEN"

echo "$ now rm --safe --yes commit-lint"
$now rm --safe --yes commit-lint

echo "$ now --public"
$now --public

echo "$ now alias"
$now alias
