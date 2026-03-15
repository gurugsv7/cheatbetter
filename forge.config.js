const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const windowsCertificateFile = process.env.WIN_CSC_LINK;
const windowsCertificatePassword = process.env.WIN_CSC_KEY_PASSWORD;
const remoteReleases = process.env.SQUIRREL_REMOTE_RELEASES;

module.exports = {
    packagerConfig: {
        asar: {
            unpack: '**/{onnxruntime-node,onnxruntime-common,@huggingface/transformers,sharp,@img}/**',
        },
        extraResource: ['./src/assets/SystemAudioDump'],
        name: 'GSV',
        icon: 'src/assets/logo',
        ...(windowsCertificateFile
            ? {
                windowsSign: {
                    certificateFile: windowsCertificateFile,
                    certificatePassword: windowsCertificatePassword || undefined,
                    timestampServer: process.env.WIN_TIMESTAMP_SERVER || 'http://timestamp.digicert.com',
                },
            }
            : {}),
        // use `security find-identity -v -p codesigning` to find your identity
        // for macos signing
        // also fuck apple
        // osxSign: {
        //    identity: '<paste your identity here>',
        //   optionsForFile: (filePath) => {
        //       return {
        //           entitlements: 'entitlements.plist',
        //       };
        //   },
        // },
        // notarize if off cuz i ran this for 6 hours and it still didnt finish
        // osxNotarize: {
        //    appleId: 'your apple id',
        //    appleIdPassword: 'app specific password',
        //    teamId: 'your team id',
        // },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'GSV',
                productName: 'GSV',
                shortcutName: 'GSV',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
                ...(remoteReleases ? { remoteReleases } : {}),
            },
        },
        {
            name: '@electron-forge/maker-zip',
            platforms: ['win32'],
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
        },
        {
            name: '@reforged/maker-appimage',
            platforms: ['linux'],
            config: {
                options: {
                    name: 'GSV',
                    productName: 'GSV',
                    genericName: 'AI Assistant',
                    description: 'AI assistant for interviews and learning',
                    categories: ['Development', 'Education'],
                    icon: 'src/assets/logo.png'
                }
            },
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
