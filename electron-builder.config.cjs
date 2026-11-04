const brand = require('./src/shared/branding.json')

const name = 'gege-downloader'
const productName = brand.name
const appId = brand.appId
const executableName = brand.executableName
const protocol = brand.protocol
const repo = brand.updateRepo.split('/')[1]
const owner = brand.updateRepo.split('/')[0]

module.exports = {
  appId,
  productName,
  copyright: brand.copyright,
  afterPack: 'scripts/check-torrent-package.mjs',
  directories: { buildResources: 'build' },
  files: [
    '!**/.vscode/*',
    '!src/*',
    '!electron.vite.config.{js,ts,mjs,cjs}',
    '!{.eslintcache,eslint.config.mjs,.prettierignore,.prettierrc.yaml,dev-app-update.yml,CHANGELOG.md,README.md}',
    '!{.env,.env.*,.npmrc,pnpm-lock.yaml}',
    '!node_modules/koffi/{src,vendor,doc}/**',
    '!node_modules/koffi/build/koffi/!(linux_x64|linux_arm64|win32_x64|win32_arm64)/**',
    '!node_modules/node-datachannel/**',
    '!node_modules/webrtc-polyfill/**',
    '!{tsconfig.json,tsconfig.node.json,tsconfig.web.json}',
    '!resources/legendary/**'
  ],
  asarUnpack: ['resources/**', '!resources/legendary/**'],
  extraResources: [{ from: 'resources/legendary', to: 'legendary' }],
  win: {
    executableName,
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  nsis: {
    artifactName: '${name}-${version}-setup.${ext}',
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always'
  },
  mac: {
    artifactName: '${name}-${version}-${arch}-mac.${ext}',
    target: [
      { target: 'dmg', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] }
    ],
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: [
      { NSDownloadsFolderUsageDescription: `${productName} saves downloaded files to your Downloads folder.` },
      {
        CFBundleURLTypes: [
          { CFBundleURLName: 'Magnet link', CFBundleURLSchemes: ['magnet'] },
          { CFBundleURLName: productName, CFBundleURLSchemes: [protocol] }
        ],
        CFBundleDocumentTypes: [
          {
            CFBundleTypeName: 'Torrent',
            CFBundleTypeRole: 'Viewer',
            LSHandlerRank: 'Alternate',
            CFBundleTypeExtensions: ['torrent'],
            LSItemContentTypes: ['org.bittorrent.torrent']
          }
        ]
      }
    ]
  },
  dmg: { artifactName: '${name}-${version}-${arch}.${ext}' },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
      { target: 'rpm', arch: ['x64'] }
    ],
    maintainer: 'electronjs.org',
    category: 'Utility',
    mimeTypes: [`x-scheme-handler/magnet`, 'application/x-bittorrent', `x-scheme-handler/${protocol}`]
  },
  appImage: { artifactName: '${name}-${version}-${arch}.${ext}' },
  npmRebuild: false,
  publish: { provider: 'github', owner, repo }
}
