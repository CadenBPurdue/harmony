const axios = require('axios');

axios.get()


// client ID and redirect URI
const clientId = '3852c03c669e46dd93e28ee6d4bd15c4';
const redirectUri = 'http://localhost:3000/callback'; // e.g., 'http://localhost:3000/callback'
const state = 'IN'; // Optional but recommended for security

// Construct the authorization URL
const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

window.location.href = authUrl;
