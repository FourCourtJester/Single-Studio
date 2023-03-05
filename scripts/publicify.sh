#!/usr/bin/env bash

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m' # No Color

# The folder to copy
dir="public"

echo ""

# Get all project directories
for d in ../src/projects/*/; do
  # Save names for folder manipulations
  _d=$(basename $d)
  pathPublic=../$dir/$_d
  pathProject=$d/$dir

  # Check for a public folder
  if [ ! -d $pathProject ]
  then
    echo -e "${RED}$_d${NC} does not have a public folder, ${BLUE}skipping${NC}..."
    continue
  fi

  # Count number of files
  numFiles=$(ls -1 $pathProject | wc -l)

  # If zero files, continue
  if [ $numFiles -eq 0 ]
  then
    echo -e "${RED}$_d${NC} has an empty public folder, ${BLUE}skipping${NC}..."
    continue
  fi

  echo -e "$RED$_d$NC has a public folder, moving $YELLOW$numFiles$NC files/folders to $BLUE$pathPublic$NC..."

  # Files exist
  # Copy over the public folder
  mkdir -p $pathPublic
  cp -r $pathProject/* $pathPublic
done

echo ""