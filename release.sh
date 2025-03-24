#!/bin/bash

# Exit on error
set -e

# Get the current version from the code (you might want to update this based on your versioning system)
VERSION=$(grep -oP '(?<=__version__ = ").*(?=")' dpi_gui.py)

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf build/ dist/

# Build the executable
echo "Building executable..."
pyinstaller dpi_gui.spec

# Create a temporary directory for release
echo "Preparing release files..."
mkdir -p release
cp dist/dpi_gui.exe release/
cp README.md release/

# Create a zip file for the release
echo "Creating release zip..."
cd release
zip -r "../dpi_changer_v${VERSION}.zip" *
cd ..

# Create a new GitHub release
echo "Creating GitHub release..."
git add .
git commit -m "Release v${VERSION}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin main
git push origin "v${VERSION}"

# Clean up
echo "Cleaning up..."
rm -rf release

echo "Release completed successfully!"
echo "Don't forget to manually create a release on GitHub and upload the zip file: dpi_changer_v${VERSION}.zip" 