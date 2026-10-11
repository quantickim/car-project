#!/bin/sh
# 엔카는 해외(GitHub Actions) IP를 차단하므로 국내 PC에서 수집해 data/ 를 커밋·푸시한다.
# 푸시되면 GitHub Actions 가 빌드해서 Pages 에 배포한다.
set -e
cd "$(dirname "$0")/.."
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

git pull --rebase --autostash -q
npm run snapshot -- --static data
git add data/history.json data/listings.json
if git diff --cached --quiet; then
  echo "변경 없음"
  exit 0
fi
git commit -q -m "data: 엔카 시세 $(date +%F)"
git push -q
echo "푸시 완료 → GitHub Actions 배포"
