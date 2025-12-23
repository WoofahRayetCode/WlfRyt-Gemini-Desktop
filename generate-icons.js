const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
// Support both PNG and SVG source
const pngSourcePath = path.join(assetsDir, 'icon-source.png');
const svgSourcePath = path.join(assetsDir, 'icon.svg');

// Create ICO file manually (simple implementation)
function createIco(pngBuffers) {
  // ICO header: 2 bytes reserved, 2 bytes type (1 = icon), 2 bytes image count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Type (1 = ICO)
  header.writeUInt16LE(pngBuffers.length, 4); // Image count
  
  // Calculate offsets
  const dirEntrySize = 16;
  let dataOffset = 6 + (pngBuffers.length * dirEntrySize);
  
  const dirEntries = [];
  const imageData = [];
  
  for (const png of pngBuffers) {
    // Parse PNG to get dimensions (basic parsing)
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    
    // Directory entry: 16 bytes each
    const entry = Buffer.alloc(16);
    entry.writeUInt8(width >= 256 ? 0 : width, 0);   // Width (0 = 256)
    entry.writeUInt8(height >= 256 ? 0 : height, 1); // Height (0 = 256)
    entry.writeUInt8(0, 2);              // Color palette
    entry.writeUInt8(0, 3);              // Reserved
    entry.writeUInt16LE(1, 4);           // Color planes
    entry.writeUInt16LE(32, 6);          // Bits per pixel
    entry.writeUInt32LE(png.length, 8);  // Image size
    entry.writeUInt32LE(dataOffset, 12); // Image offset
    
    dirEntries.push(entry);
    imageData.push(png);
    dataOffset += png.length;
  }
  
  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

async function generateIcons() {
  console.log('Generating icons...\n');

  // Determine source file
  let sourceBuffer;
  let sourcePath;
  
  if (fs.existsSync(pngSourcePath)) {
    console.log('Using PNG source: icon-source.png');
    sourcePath = pngSourcePath;
    sourceBuffer = fs.readFileSync(pngSourcePath);
  } else if (fs.existsSync(svgSourcePath)) {
    console.log('Using SVG source: icon.svg');
    sourcePath = svgSourcePath;
    sourceBuffer = fs.readFileSync(svgSourcePath);
  } else {
    console.error('No source icon found! Please add icon-source.png or icon.svg to the assets folder.');
    process.exit(1);
  }

  // Generate PNG at various sizes
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  
  for (const size of sizes) {
    const outputPath = path.join(assetsDir, `icon-${size}.png`);
    await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated icon-${size}.png`);
  }

  // Generate main icon.png (256px for good quality)
  const mainPngPath = path.join(assetsDir, 'icon.png');
  await sharp(sourceBuffer)
    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(mainPngPath);
  console.log('✓ Generated icon.png (256x256)');

  // Generate ICO file for Windows (multi-resolution)
  const icoSizes = [16, 32, 48, 256];
  const pngBuffers = [];
  
  for (const size of icoSizes) {
    const buffer = await sharp(sourceBuffer)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer();
    pngBuffers.push(buffer);
  }

  const icoBuffer = createIco(pngBuffers);
  const icoPath = path.join(assetsDir, 'icon.ico');
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('✓ Generated icon.ico (Windows)');

  // Generate ICNS-compatible PNG for macOS (will need manual conversion or use electron-icon-builder)
  const icnsPath = path.join(assetsDir, 'icon-512.png');
  console.log('✓ icon-512.png can be converted to icon.icns for macOS');

  console.log('\n✅ All icons generated successfully!');
  console.log(`\nIcon files are in: ${assetsDir}`);
}

generateIcons().catch(console.error);
