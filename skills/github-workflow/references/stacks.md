# GitHub Stacks by `gh api`

Read this when registering or changing a stack of PRs (the github-workflow
skill, Stacked PRs). `gh` has no `stack` command; drive the REST API.

```
# list stacks; a PR also carries a "stack" object (number, size, position)
gh api repos/OWNER/REPO/stacks
gh api repos/OWNER/REPO/pulls/NUMBER --jq '.stack'

# create from an ordered list, bottom first
echo '{"pull_requests":[11,12]}' | gh api -X POST repos/OWNER/REPO/stacks --input -

# append to the top of an existing stack
echo '{"pull_requests":[21]}' | gh api -X POST repos/OWNER/REPO/stacks/STACK/add --input -

# remove unmerged PRs (200 = stack survives, 204 = dissolved)
gh api -X POST repos/OWNER/REPO/stacks/STACK/unstack --input -
```

- Send the body as JSON through `--input -`. `-f key=value` sends strings
  and the API rejects them (`"11" is not of type "integer"`).
- Register the stack when you open the chain. A merged PR cannot join one
  (422).
- Check `.stack` on each PR first: GitHub may already have created a stack
  for PRs that target each other, in which case append to it.
