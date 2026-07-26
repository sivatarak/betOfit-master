// withTrimVectorIcons.js
// Expo config plugin: shrinks unused @expo/vector-icons font families down
// to near-zero size, keeping only the ones actually used by the app.
//
// IMPORTANT: we do NOT delete the .ttf files. @expo/vector-icons/build/IconsLazy.js
// statically imports every font file at module level, so Metro's bundler needs
// each file to exist to resolve those imports — even for icon sets you never
// render. Deleting them causes "Unable to resolve module" bundling errors.
//
// Instead, we overwrite each unused font file with a minimal 1-byte placeholder.
// This satisfies Metro's import resolution (file exists) while cutting its
// bundled size from hundreds of KB down to ~1 byte. Since these fonts are never
// actually rendered (no icon from these families is used), the invalid font
// content is never parsed/loaded at runtime.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Only these font families are kept at full size. Add more names here if you
// start using another icon family (e.g. 'MaterialIcons') anywhere in the app.
const FONTS_TO_KEEP = ['Ionicons.ttf'];

function withTrimVectorIcons(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;

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
      let shrunk = 0;
      let savedBytes = 0;

      for (const file of files) {
        if (!file.endsWith('.ttf')) continue;
        if (FONTS_TO_KEEP.includes(file)) continue;

        const fullPath = path.join(fontsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          // Overwrite with a 1-byte placeholder instead of deleting.
          // Keeps the file present (so Metro's static import resolves)
          // while reducing its bundled size to almost nothing.
          fs.writeFileSync(fullPath, Buffer.from([0]));
          shrunk++;
          savedBytes += stat.size - 1;
        } catch (e) {
          console.warn('[withTrimVectorIcons] Could not shrink', file, e.message);
        }
      }

      console.log(
        `[withTrimVectorIcons] Shrunk ${shrunk} unused font file(s) to placeholders, saved ~${(
          savedBytes / (1024 * 1024)
        ).toFixed(2)} MB`
      );

      return config;
    },
  ]);
}

module.exports = withTrimVectorIcons;