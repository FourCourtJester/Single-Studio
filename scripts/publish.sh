#!/usr/bin/env bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[1;34m'
NC='\033[0m' # No Color

public_folder_name="public" # Name of the folder we're copying public data from

destination_folder="./$public_folder_name" # Destination folder where "public" folders will be copied into subdirectories with matching names
source_folder="./src/studios" # Source folder where you want to start searching for "public" folders
temp_source_folder="./studios.temp" # Temp folder for the studio folders to exist

# Check if the destination folder exists, and if not, create it
if [ ! -d "$destination_folder" ]; then
  mkdir -p "$destination_folder"
fi

# Check if the studio temp folder exists, and if not, create it
if [ ! -d "$temp_source_folder" ]; then
  mkdir -p "$temp_source_folder"
fi

# Start copying folders
# Loop through the subdirectories in the source folder
for subfolder in "$source_folder"/*; do
  if [ -d "$subfolder" ]; then
    subfolder_name=$(basename "$subfolder")

    # Check if the subdirectory contains a "public" folder
    if [ ! -d "$subfolder/$public_folder_name" ]; then
      echo -e "$RED$_d$NC does not have a $YELLOW$public_folder_name$NC folder, ${BLUE}skipping$NC..."
      continue
    fi

    dest_folder="$destination_folder/$subfolder_name"

    # Create the destination directory with the same name if it doesn't exist
    if [ ! -d "$dest_folder" ]; then
      if ! mkdir -p "$dest_folder"; then
        echo -e "${RED}Error creating $dest_folder.$NC"
        exit 1
      fi
    fi

    # Copy the "public" folder and its contents to the destination
    cp -r "$subfolder/$public_folder_name"/* "$dest_folder/"

    if [ $? -eq 0 ]; then
      echo -e "Copied $YELLOW$subfolder/$public_folder_name$NC to $YELLOW$dest_folder$NC."
    else
      echo -e "${RED}Error copying $subfolder/$public_folder_name to $dest_folder.$NC"
    fi

    # Copy the studio folder to the temp destination
    cp -r "$subfolder/$public_folder_name" "$temp_source_folder/$subfolder_name"

    if [ ! $? -eq 0 ]; then
      echo -e "${RED}Error copying $subfolder/$public_folder_name to $temp_source_folder/$subfolder_name.$NC"
    fi

    # Remove the studio public folder
    rm -rf "$subfolder/$public_folder_name"

    if [ ! $? -eq 0 ]; then
      echo -e "${RED}Error removing $subfolder/$public_folder_name.$NC"
    fi
  fi
done

# Compile React
npm run build

if [ ! $? -eq 0 ]; then
  exit 1
fi

# Run the GH Pages deploy
gh-pages -d build

echo ""

# Start copying folders
# Loop through the subdirectories in the source folder
for subfolder in "$temp_source_folder"/*; do
  if [ -d "$subfolder" ]; then
    subfolder_name=$(basename "$subfolder")

    dest_folder="$source_folder/$subfolder_name/$public_folder_name"

    # Create the destination directory with the same name if it doesn't exist
    if [ ! -d "$dest_folder" ]; then
      if ! mkdir -p "$dest_folder"; then
        echo -e "${RED}Error creating $dest_folder.$NC"
        exit 1
      fi
    fi

    # Copy the "public" folder and its contents to the destination
    cp -r "$subfolder"/* "$dest_folder/"

    if [ $? -eq 0 ]; then
      echo -e "Copied $GREEN$subfolder/$public_folder_name$NC back to $GREEN$dest_folder$NC."
    else
      echo -e "${RED}Error copying $subfolder/$subfolder_name to $dest_folder.$NC"
    fi
  fi
done

echo -e "Removing ${YELLOW}temporary$NC folders."

# Clean up the temp folders
rm -rf "$temp_source_folder"

if [ ! $? -eq 0 ]; then
  echo -e "${RED}Error removing temporary folders.$NC"
fi

echo ""

echo -e "${GREEN}Deploy complete.$NC"