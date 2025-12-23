# Gemini Desktop Build Script
# Run: .\build.ps1
# Optimized for multi-core CPUs (Ryzen 9 8940HX - 16 cores / 32 threads)

Write-Host "=== Gemini Desktop Build Script ===" -ForegroundColor Cyan
Write-Host ""

# Detect CPU cores/threads for parallel processing
$cpuCores = (Get-CimInstance -ClassName Win32_Processor).NumberOfCores
$cpuThreads = (Get-CimInstance -ClassName Win32_Processor).NumberOfLogicalProcessors
Write-Host "CPU: $cpuCores cores / $cpuThreads threads detected" -ForegroundColor Gray

# Set environment variables for parallel processing
$env:UV_THREADPOOL_SIZE = $cpuThreads
$env:NODE_OPTIONS = "--max-old-space-size=8192"

# Generate timestamp version (YYYY.MM.DD.HHMM)
$version = Get-Date -Format "yyyy.MM.dd.HHmm"
Write-Host "Build Version: $version" -ForegroundColor Magenta

# Update package.json with timestamp version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$packageJson.version = $version
$packageJson | ConvertTo-Json -Depth 10 | Set-Content "package.json"
Write-Host "Updated package.json version to $version" -ForegroundColor Gray

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies (using $cpuThreads concurrent connections)..." -ForegroundColor Yellow
    # Use maximum concurrent connections for faster npm install
    npm install --maxsockets=$cpuThreads
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install dependencies!" -ForegroundColor Red
        exit 1
    }
}

# Check if icons exist, generate if not
if (-not (Test-Path "assets\icon.ico")) {
    Write-Host "Generating icons..." -ForegroundColor Yellow
    node generate-icons.js
}

# Clean any user data that might have been created during development
Write-Host "Ensuring clean build (no user data)..." -ForegroundColor Yellow
$userDataPaths = @(
    "userData",
    "Cookies",
    "Local Storage",
    "Session Storage",
    "IndexedDB",
    "Cache",
    "GPUCache",
    "settings.json"
)
foreach ($path in $userDataPaths) {
    if (Test-Path $path) {
        Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Removed: $path" -ForegroundColor Gray
    }
}

Write-Host "Building Gemini Desktop for Windows..." -ForegroundColor Yellow
npx electron-packager . "Gemini Desktop" --platform=win32 --arch=x64 --out=dist --overwrite --asar --icon=assets/icon.ico --ignore="\.git" --ignore="dist" --ignore="\.github"

# Clean any user data from the built app (in case it was included)
$builtAppData = "dist\Gemini Desktop-win32-x64\resources\app"
if (Test-Path $builtAppData) {
    foreach ($path in $userDataPaths) {
        $fullPath = Join-Path $builtAppData $path
        if (Test-Path $fullPath) {
            Remove-Item $fullPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Build Successful! ===" -ForegroundColor Green
    Write-Host ""
    
    # Create 7zip archive
    $archiveName = "dist\Gemini-Desktop-$version-win32-x64.7z"
    Write-Host "Creating 7zip archive..." -ForegroundColor Yellow
    
    # Check if 7-Zip is available
    $7zPath = $null
    if (Get-Command "7z" -ErrorAction SilentlyContinue) {
        $7zPath = "7z"
    } elseif (Test-Path "C:\Program Files\7-Zip\7z.exe") {
        $7zPath = "C:\Program Files\7-Zip\7z.exe"
    } elseif (Test-Path "C:\Program Files (x86)\7-Zip\7z.exe") {
        $7zPath = "C:\Program Files (x86)\7-Zip\7z.exe"
    }
    
    if ($7zPath) {
        # Remove existing archive if it exists
        if (Test-Path $archiveName) {
            Remove-Item $archiveName -Force
        }
        
        # Create 7zip archive with maximum compression using all CPU threads
        # -mmt=$cpuThreads: Use all available threads
        # -mx=9: Maximum compression level
        # -md=64m: 64MB dictionary size for better compression
        # -mfb=273: Maximum fast bytes
        Write-Host "  Using $cpuThreads threads for compression..." -ForegroundColor Gray
        & $7zPath a -t7z -mx=9 -mmt=$cpuThreads -md=64m -mfb=273 $archiveName "dist\Gemini Desktop-win32-x64\*"
        
        if ($LASTEXITCODE -eq 0) {
            $archiveSize = (Get-Item $archiveName).Length / 1MB
            Write-Host "  Created: $archiveName ($([math]::Round($archiveSize, 2)) MB)" -ForegroundColor Green
        } else {
            Write-Host "  Warning: Failed to create 7zip archive" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Warning: 7-Zip not found. Install from https://7-zip.org/ to create .7z archives." -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Version: $version" -ForegroundColor Cyan
    Write-Host "Output location:" -ForegroundColor Cyan
    Write-Host "  dist\Gemini Desktop-win32-x64\Gemini Desktop.exe" -ForegroundColor White
    if ($7zPath -and (Test-Path $archiveName)) {
        Write-Host "  $archiveName" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Note: App is clean with no saved login data." -ForegroundColor Green
    Write-Host ""
    
    # Ask if user wants to run the app
    $run = Read-Host "Run the app now? (y/n)"
    if ($run -eq "y" -or $run -eq "Y") {
        Start-Process "dist\Gemini Desktop-win32-x64\Gemini Desktop.exe"
    }
} else {
    Write-Host ""
    Write-Host "=== Build Failed! ===" -ForegroundColor Red
    exit 1
}
