#!/bin/bash
# Gemini Desktop Build Script for SteamOS (Arch-based Linux)
# Run: chmod +x build-steamos.sh && ./build-steamos.sh
# Optimized for Steam Deck and SteamOS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}=== Gemini Desktop Build Script for SteamOS ===${NC}"
echo ""

# Detect CPU cores/threads for parallel processing
CPU_CORES=$(nproc --all 2>/dev/null || echo 4)
echo -e "${GRAY}CPU: ${CPU_CORES} threads detected${NC}"

# Set environment variables for parallel processing
export UV_THREADPOOL_SIZE=$CPU_CORES
export NODE_OPTIONS="--max-old-space-size=4096"

# Generate timestamp version (YYYY.MM.DD.HHMM)
VERSION=$(date +"%Y.%m.%d.%H%M")
echo -e "${MAGENTA}Build Version: ${VERSION}${NC}"

# Update package.json with timestamp version
if command -v node &> /dev/null; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '${VERSION}';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "
    echo -e "${GRAY}Updated package.json version to ${VERSION}${NC}"
else
    echo -e "${RED}Node.js not found! Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm not found! Please install Node.js and npm.${NC}"
    echo -e "${YELLOW}On SteamOS, you may need to install via flatpak or use nvm:${NC}"
    echo -e "${WHITE}  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash${NC}"
    echo -e "${WHITE}  source ~/.bashrc${NC}"
    echo -e "${WHITE}  nvm install --lts${NC}"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies!${NC}"
        exit 1
    fi
fi

# Check if icons exist, generate if not
if [ ! -f "assets/icon.png" ]; then
    echo -e "${YELLOW}Generating icons...${NC}"
    node generate-icons.js
fi

# Clean any user data that might have been created during development
echo -e "${YELLOW}Ensuring clean build (no user data)...${NC}"
USER_DATA_PATHS=("userData" "Cookies" "Local Storage" "Session Storage" "IndexedDB" "Cache" "GPUCache" "settings.json")
for path in "${USER_DATA_PATHS[@]}"; do
    if [ -e "$path" ]; then
        rm -rf "$path"
        echo -e "${GRAY}  Removed: ${path}${NC}"
    fi
done

# Determine architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        ELECTRON_ARCH="x64"
        ;;
    aarch64)
        ELECTRON_ARCH="arm64"
        ;;
    armv7l)
        ELECTRON_ARCH="armv7l"
        ;;
    *)
        ELECTRON_ARCH="x64"
        echo -e "${YELLOW}Unknown architecture ${ARCH}, defaulting to x64${NC}"
        ;;
esac

echo -e "${YELLOW}Building Gemini Desktop for Linux (${ELECTRON_ARCH})...${NC}"
npx electron-packager . "Gemini Desktop" \
    --platform=linux \
    --arch=$ELECTRON_ARCH \
    --out=dist \
    --overwrite \
    --asar \
    --icon=assets/icon.png \
    --ignore="\.git" \
    --ignore="dist" \
    --ignore="\.github" \
    --ignore="userData" \
    --ignore="settings\.json" \
    --ignore="build\.ps1" \
    --ignore="build-steamos\.sh"

BUILD_EXIT_CODE=$?

# Clean any user data from the built app (in case it was included)
BUILT_APP_DIR="dist/Gemini Desktop-linux-${ELECTRON_ARCH}"
if [ -d "$BUILT_APP_DIR/resources/app" ]; then
    for path in "${USER_DATA_PATHS[@]}"; do
        if [ -e "$BUILT_APP_DIR/resources/app/$path" ]; then
            rm -rf "$BUILT_APP_DIR/resources/app/$path"
        fi
    done
fi

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}=== Build Successful! ===${NC}"
    echo ""
    
    # Create .desktop file for Steam/Linux integration
    DESKTOP_FILE="${BUILT_APP_DIR}/gemini-desktop.desktop"
    cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=Gemini Desktop
Comment=Standalone desktop app for Google Gemini
Exec="${BUILT_APP_DIR}/Gemini Desktop" %U
Icon=${BUILT_APP_DIR}/resources/app/assets/icon.png
Type=Application
Categories=Network;Chat;Utility;
Terminal=false
StartupWMClass=Gemini Desktop
MimeType=x-scheme-handler/gemini-desktop;
EOF
    echo -e "${GRAY}Created .desktop file for Linux integration${NC}"
    
    # Create archive
    ARCHIVE_NAME="dist/Gemini-Desktop-${VERSION}-linux-${ELECTRON_ARCH}.tar.gz"
    echo -e "${YELLOW}Creating tar.gz archive...${NC}"
    
    # Remove existing archive if it exists
    if [ -f "$ARCHIVE_NAME" ]; then
        rm -f "$ARCHIVE_NAME"
    fi
    
    # Create tarball
    echo -e "${GRAY}  Using ${CPU_CORES} threads for compression...${NC}"
    cd dist
    if command -v pigz &> /dev/null; then
        # Use pigz for parallel compression if available
        tar -cf - "Gemini Desktop-linux-${ELECTRON_ARCH}" | pigz -p $CPU_CORES > "Gemini-Desktop-${VERSION}-linux-${ELECTRON_ARCH}.tar.gz"
    else
        tar -czf "Gemini-Desktop-${VERSION}-linux-${ELECTRON_ARCH}.tar.gz" "Gemini Desktop-linux-${ELECTRON_ARCH}"
    fi
    cd ..
    
    if [ -f "$ARCHIVE_NAME" ]; then
        ARCHIVE_SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
        echo -e "${GREEN}  Created: ${ARCHIVE_NAME} (${ARCHIVE_SIZE})${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Version: ${VERSION}${NC}"
    echo -e "${CYAN}Output location:${NC}"
    echo -e "${WHITE}  ${BUILT_APP_DIR}/Gemini Desktop${NC}"
    if [ -f "$ARCHIVE_NAME" ]; then
        echo -e "${WHITE}  ${ARCHIVE_NAME}${NC}"
    fi
    echo ""
    echo -e "${GREEN}Note: App is clean with no saved login data.${NC}"
    echo ""
    
    # Provide SteamOS-specific instructions
    echo -e "${CYAN}=== SteamOS / Steam Deck Instructions ===${NC}"
    echo ""
    echo -e "${WHITE}To add to Steam as a non-Steam game:${NC}"
    echo -e "${GRAY}  1. Switch to Desktop Mode${NC}"
    echo -e "${GRAY}  2. Open Steam → Add a Game → Add a Non-Steam Game${NC}"
    echo -e "${GRAY}  3. Browse to: ${BUILT_APP_DIR}/Gemini Desktop${NC}"
    echo -e "${GRAY}  4. Add Selected Programs${NC}"
    echo ""
    echo -e "${WHITE}To install system-wide (requires sudo):${NC}"
    echo -e "${GRAY}  sudo cp -r \"${BUILT_APP_DIR}\" /opt/gemini-desktop${NC}"
    echo -e "${GRAY}  sudo cp \"${DESKTOP_FILE}\" /usr/share/applications/${NC}"
    echo ""
    
    # Ask if user wants to run the app
    read -p "Run the app now? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        "${BUILT_APP_DIR}/Gemini Desktop" &
    fi
else
    echo ""
    echo -e "${RED}=== Build Failed! ===${NC}"
    exit 1
fi
