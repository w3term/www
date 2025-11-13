# Web Terminal Embed

A lightweight JavaScript library for embedding interactive terminal sessions in web applications. Provides SSH access to Linux VMs with GitHub OAuth authentication.

## Quick Start

Add the script to your HTML page:

```html
<script src="https://cdn.jsdelivr.net/npm/@w3term/terminal@latest/terminal.min.js"></script>
<script>
const terminal = new WebTerminalEmbed({
    githubAppName: 'your-app-name',
    githubClientId: 'your-client-id',
    backendDomain: 'your-domain.com'
});
</script>
```

## CDN URLs

- **Latest**: `https://cdn.jsdelivr.net/npm/@ww3term/terminal@latest/terminal.min.js`
- **Specific version**: `https://cdn.jsdelivr.net/npm/@w3term/terminal@X.Y.Z/terminal.min.js`

## Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `githubAppName` | ✅ | Name of your GitHub OAuth application |
| `githubClientId` | ✅ | OAuth App Client ID from GitHub Developer Settings |
| `backendDomain` | ❌ | Your backend domain (leave empty for localhost development) |
| `vmType` | ❌ | Type of VM environment (default: 'cka') |
| `debug` | ❌ | Enable console logging (auto-detects localhost) |

## Features

- SSH access to Exoscale Linux VMs
- Multiple terminal tabs
- Resizable interface
- GitHub OAuth authentication
- Session management
- Auto-reconnection
