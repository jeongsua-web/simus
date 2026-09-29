#!/bin/zsh
set -eu
script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
unity_app="/Applications/Unity/Hub/Editor/6000.3.24f1/Unity.app"
if [[ ! -d "$unity_app" ]]; then
  print "Unity Hub에서 6000.3.24f1을 설치하거나 SIMUSPrototype 폴더를 프로젝트로 추가해 주세요."
  read -r "?Enter 키를 누르면 닫힙니다. "
  exit 1
fi
/usr/bin/open -n -a "$unity_app" --args -projectPath "$script_dir/SIMUSPrototype"
