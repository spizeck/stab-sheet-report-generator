# Security Policy

## Data Processing

### Client-Side Only

The Stab Sheet Report Generator processes all uploaded files **entirely in your browser**. 

- Files are read using the browser's File API
- All calculations happen locally in JavaScript
- **No files are intentionally uploaded to or stored on any server**
- Data exists only in your browser's memory during the session
- When you close the tab or refresh, all data is cleared

### Important Warnings

While the current version is designed to be client-side only, users should be aware:

1. **Deployment Environment**: If you are using a hosted version of this app, verify the deployment configuration. The app should be served over HTTPS to prevent man-in-the-middle attacks.

2. **Browser Extensions**: Third-party browser extensions may have access to page content. Be cautious when processing sensitive project data.

3. **Network Environment**: Ensure you are using a secure, trusted network when uploading proprietary or regulated project data.

4. **Future Versions**: If server-side features are added in the future, this policy will be updated accordingly.

## Responsible Disclosure

If you discover a security vulnerability in this project, please report it responsibly:

**Email**: [chadnuttall1@gmail.com](mailto:chadnuttall1@gmail.com)

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

We will acknowledge receipt within 48 hours and provide a timeline for resolution.

## Production Deployment Recommendations

When deploying this application for production use:

1. **Use HTTPS**: Always serve the application over HTTPS
2. **Vercel Environment Variables**: If adding server-side features in the future, use Vercel's environment variable system for secrets
3. **Content Security Policy**: Consider implementing a CSP to prevent XSS attacks
4. **Dependency Updates**: Regularly update dependencies to patch security vulnerabilities

## Supported Versions

| Version | Supported          |
| --------- | ------------------ |
| Latest   | :white_check_mark: |
| Older    | :x:                |

Only the latest version receives security updates.
