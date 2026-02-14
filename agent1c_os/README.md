# HedgeyOS

A sophisticated Mac OS 9-inspired web desktop environment that runs entirely in your browser. HedgeyOS recreates the classic desktop experience with modern web technologies, featuring window management, an application ecosystem, encrypted file storage, and comprehensive theming.

## 🌟 Features

### Desktop Environment
- **Full Window Management**: Create, drag, resize, minimize, and maximize windows
- **Menu Bar System**: Apple-style menu with system, file, and apps menus
- **Desktop Icons**: Clickable application shortcuts with organized layout
- **Theme System**: Multiple OS-inspired themes with dark mode variants

### Application Ecosystem
- **Built-in Apps**:
  - **Files**: Encrypted file manager with IndexedDB storage
  - **Notes**: Text editor with auto-save functionality
  - **Browser**: Web browser with navigation controls
  - **Themes**: Visual theme switcher interface
  - **Terminal**: Web-based terminal with xterm.js

- **External Apps** (via `apps.json`):
  - Games: Flipside, 3D Hedgey Town, Chordynaut, Tetris3D
  - Utilities: DecenTerminal, PythonCity, RSS Reader
  - Media: HedgeyTube (advanced YouTube/Spotify/SoundCloud player)

### Security & Storage
- **Client-Side Encryption**: All files encrypted using Web Crypto API
- **Secure Storage**: IndexedDB with AES encryption and optional passphrase protection
- **Sandboxed Apps**: External applications loaded in secure iframes
- **Cross-Origin Isolation**: Enhanced security via COI service worker

### Media & Integration
- **HedgeyTube**: Sophisticated media player with URL detection and playlist management
- **Embed Conversion**: Smart parsing of video/playlist URLs from YouTube, Spotify, SoundCloud
- **AR Overlay**: Camera integration via HUD for augmented reality features

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3 (no frameworks)
- **Storage**: IndexedDB + LocalStorage with encryption layer
- **Security**: Cross-Origin Isolation, Web Crypto API
- **Fonts**: EnvyCodeR Nerd Font for terminal aesthetic

### Modular Structure
```
js/
├── main.js              # Application orchestrator
├── wm.js                # Window Manager (core UI)
├── filesystem.js        # Encrypted storage layer
├── apps-menu.js         # Application launcher
├── menubar.js           # Top menu bar functionality
├── theme.js             # Theme switching and management
└── [specialized modules]
```

### Theme System
- **OS 9 Classic**: Default Mac OS 9-inspired theme
- **System 7**: Earlier Mac OS aesthetic
- **BeOS**: BeOS-inspired yellow titlebar theme
- **HedgeyOS**: Custom pink-themed variant
- **Dark Modes**: Night themes for all variants
- **Cyberpunk Red**: Futuristic dark theme
- **Greenscreen**: Terminal-style monochrome

## 🚀 Getting Started

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/hedgeyos/hedgeyos.github.io.git
   cd hedgeyos.github.io
   ```

2. Serve locally:
   ```bash
   python3 -m http.server 8000
   # or use any static server
   ```

3. Open `http://localhost:8000` in your browser

### Direct Access
You can also open `index.html` directly in your browser, though some features may require a server context.

## 🌐 Live Demo

Visit the live site at [https://hedgeyos.github.io](https://hedgeyos.github.io)

## 📱 Mobile Support

HedgeyOS includes responsive design adaptations for tablet and mobile devices, with touch-friendly interface modifications.

## 🔧 Configuration

### Adding External Apps
Edit `apps.json` to add new web applications to the desktop environment. Apps are loaded via iframes with secure sandboxing.

### Custom Themes
Themes are managed through CSS custom properties in `styles.css`. New themes can be added by defining color variable sets.

## 🛡️ Security Features

- **Client-Side Encryption**: All user data encrypted before storage
- **Key Management**: Optional passphrase protection with key wrapping
- **Cross-Origin Isolation**: Prevents certain web-based attack vectors
- **Sandboxed Applications**: External apps isolated from main system

## 📦 Deployment

### Local Hosting
HedgeyOS can be hosted locally using any static web server:

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

### GitHub Pages
The repository is configured for GitHub Pages deployment:
1. Enable Pages on the default branch
2. Site becomes available at `https://hedgeyos.github.io`

### Static Hosting
Any static file hosting service can serve HedgeyOS - no build process required. This includes:
- Netlify, Vercel, or similar platforms
- Apache/Nginx servers
- CDN services
- Local network hosting

## 🤝 Contributing

HedgeyOS is built with vanilla web technologies and follows a modular architecture. Contributions are welcome for:
- New applications and features
- Theme improvements
- Mobile experience enhancements
- Security optimizations

## 📄 License

This project maintains the same license as the original repository.

## 🔮 Future Development

- Enhanced application ecosystem
- Advanced file management features
- Improved mobile experience
- Additional theme variants
- Performance optimizations 
