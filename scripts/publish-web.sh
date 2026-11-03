#!/usr/bin/env bash
# Publish dist as its own Git history without changing the source checkout.
set -euo pipefail
[[ -s dist/index.html && -s dist/models/RobotExpressive.glb ]] || { echo 'Run npm run build first'; exit 1; }
parent=''
if git ls-remote --exit-code --heads origin web >/dev/null; then
  git fetch origin refs/heads/web:refs/remotes/origin/web
  parent=$(git rev-parse refs/remotes/origin/web)
else
  status=$?
  [[ $status == 2 ]] || exit "$status"
fi
index_dir=$(mktemp -d)
trap 'rm -rf "$index_dir"' EXIT
export GIT_DIR="$(git rev-parse --absolute-git-dir)"
export GIT_WORK_TREE="$PWD/dist"
export GIT_INDEX_FILE="$index_dir/index"
cd dist
git read-tree --empty
git add --force --all .
tree=$(git write-tree)
if [[ -n $parent && $tree == "$(git rev-parse "$parent^{tree}")" ]]; then
  echo 'web already contains this build'; exit 0
fi
parents=()
[[ -z $parent ]] || parents=(-p "$parent")
commit=$(git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit-tree "$tree" "${parents[@]}" -m 'Update compiled Aether RPG')
git push origin "$commit:refs/heads/web"
