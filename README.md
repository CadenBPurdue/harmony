# Project Harmony

Harmony is a cross-platform desktop application that allows users to share and manage music playlists across different streaming services (Spotify and Apple Music). It provides a unified interface for managing your music library and sharing playlists with friends.

![Harmony Logo](assets/icon.png)

## Features

- **Multi-service Integration**: Connect to both Spotify and Apple Music accounts
- **Playlist Management**: View, create, and manage playlists from multiple music services
- **Playlist Sharing**: Share playlists with friends across different streaming platforms
- **Friend System**: Add friends and see what they're listening to
- **Notifications**: Stay updated with friend requests and shared playlists
- **Cross-platform**: Works on Windows, macOS, and Linux (experimental)

## Technologies Used

- **Frontend**: React, Material UI
- **Backend**: Electron, Node.js
- **Authentication**: Firebase Authentication with Google Sign-in, Spotify, and Apple Music via OAuth2
- **Database**: Firestore
- **Music APIs**: Spotify API, Apple Music API
- **Build Tools**: Vite, Electron Builder
- **Testing**: Vitest
- **CI/CD**: GitHub Actions

## Installation

You can download the latest version of Harmony from the [Releases](https://github.com/cadenbpurdue/harmony/releases) page. Pre-built packages are available for Windows (.exe), macOS (.dmg), and Linux (.deb).

### Development Setup

1. Clone the repository
    ```bash
    git clone https://github.com/YourUsername/harmony.git
    cd harmony
    ```

2. Install dependencies
    ```bash
    npm install
    ```

3. Create a `.dev.env` file in the project root with the following variables:
    ```
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    GOOGLE_REDIRECT_URI=your_google_redirect_uri
    FIREBASE_API_KEY=your_firebase_api_key
    FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
    FIREBASE_PROJECT_ID=your_firebase_project_id
    FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
    APPLE_TEAM_ID=your_apple_team_id
    APPLE_KEY_ID=your_apple_key_id
    APPLE_PRIVATE_KEY=your_apple_private_key
    ```

4. Start the development server
    ```bash
    npm run dev
    ```


## Authors

- Adam Kahl
- Caden Brennan
- Ethan Burmane

## License

This project is licensed under the XYZ license