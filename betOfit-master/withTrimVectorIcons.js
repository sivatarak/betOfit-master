// withTrimVectorIcons.js
// Expo config plugin: removes unused @expo/vector-icons font families from
// the Android build output, keeping only the ones actually used by the app.
// This runs during `expo prebuild`, after Android native files are generated.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Only these font families will be kept. Add more names here if you start
// using another icon family (e.g. 'MaterialIcons') anywhere in the app.
const FONTS_TO_KEEP = ['Ionicons.ttf'];

function withTrimVectorIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

      // Where @expo/vector-icons keeps its source font files.
      const fontsDir = path.join(
        projectRoot,
        'node_modules',
        '@expo',
        'vector-icons',
        'build',
        'vendor',
        'react-native-vector-icons',
        'Fonts'
      );

      if (!fs.existsSync(fontsDir)) {
        console.warn('[withTrimVectorIcons] Fonts dir not found, skipping:', fontsDir);
        return config;
      }

      const files = fs.readdirSync(fontsDir);
      let removed = 0;
      let savedBytes = 0;

      for (const file of files) {
        if (!file.endsWith('.ttf')) continue;
        if (FONTS_TO_KEEP.includes(file)) continue;

        const fullPath = path.join(fontsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          fs.unlinkSync(fullPath);
          removed++;
          savedBytes += stat.size;
        } catch (e) {
          console.warn('[withTrimVectorIcons] Could not remove', file, e.message);
        }
      }

      console.log(
        `[withTrimVectorIcons] Removed ${removed} unused font file(s), saved ~${(
          savedBytes / (1024 * 1024)
        ).toFixed(2)} MB`
      );

      return config;
    },
  ]);
}

module.exports = withTrimVectorIcons;