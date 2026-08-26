const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Only these fonts are actually used in the app
const USED_FONTS = ['Ionicons.ttf', 'MaterialIcons.ttf', 'Feather.ttf'];

// Create a tiny placeholder TTF file Metro can resolve
const placeholderPath = path.join(__dirname, '.metro-placeholder.ttf');
if (!fs.existsSync(placeholderPath)) {
  // Minimal valid TTF header (12 bytes)
  fs.writeFileSync(placeholderPath, Buffer.alloc(12));
}

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Check if this is an unused vector icon font
  if (moduleName.includes('react-native-vector-icons/Fonts/')) {
    const fontFile = path.basename(moduleName);
    if (!USED_FONTS.includes(fontFile)) {
      // Redirect to placeholder instead of blocking
      return {
        filePath: placeholderPath,
        type: 'sourceFile',
      };
    }
  }

  // Default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;