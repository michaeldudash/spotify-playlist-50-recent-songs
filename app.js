const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const schedule = require('node-schedule');

require('dotenv').config();

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
});

// Function to save tokens
const saveTokens = (accessToken, refreshToken) => {
    // Save tokens securely (e.g., write to a file or database)
    require('fs').writeFileSync('./tokens.json', JSON.stringify({ accessToken, refreshToken }));
};

// Function to load saved tokens
const loadTokensFromFile = () => {

    const fs = require('fs');
    if (!fs.existsSync('./tokens.json')) {
        console.log('No tokens.json file found. Please authenticate first.');
        return null;
    }

    try {
        const tokens = JSON.parse(require('fs').readFileSync('./tokens.json', 'utf8'));
        spotifyApi.setAccessToken(tokens.accessToken);
        spotifyApi.setRefreshToken(tokens.refreshToken);
        return tokens;
    } catch (err) {
        console.error('Error loading tokens:', err.message);
        return null;
    }
};


const refreshAccessToken = async () => {
    try {
        const data = await spotifyApi.refreshAccessToken();
        const accessToken = data.body['access_token'];
        spotifyApi.setAccessToken(accessToken);
        saveTokens(accessToken, spotifyApi.getRefreshToken());
        console.log('Access token refreshed successfully!');
    } catch (err) {
        console.error('Error refreshing access token:', err.message);
    }
};

loadTokensFromFile();

const app = express();

// In-memory token storage (use a database in production)
// let userAccessToken = null;

// Redirect to login from main page
app.get('/', (req, res) => {
    res.send('Welcome! <a href="/login">Log in with Spotify</a>');
});

// Login Route
app.get('/login', (req, res) => {
    const scopes = ['user-library-read', 'playlist-modify-private'];
    const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
    res.redirect(authorizeURL);
});

// Callback Route
app.get('/callback', async (req, res) => {
    try {
        const code = req.query.code;
        const data = await spotifyApi.authorizationCodeGrant(code);

        const accessToken = data.body['access_token'];
        const refreshToken = data.body['refresh_token']; // Save this token
        const expiresIn = data.body['expires_in']; // Typically 3600 seconds

        spotifyApi.setAccessToken(accessToken);
        spotifyApi.setRefreshToken(refreshToken);

        // Save tokens persistently (e.g., to a database or file)
        saveTokens(accessToken, refreshToken);

        res.send('Authentication successful! Tokens saved.');

        // Call updatePlaylist() after successful authentication
        updatePlaylist();
    } catch (err) {
        res.status(400).send('Error during authentication: ' + err.message);
    }
});

// Update Playlist Function
const updatePlaylist = async () => {

    try {
        // Ensure Spotify API has valid tokens
        const tokens = loadTokensFromFile();
        if (!tokens) {
            console.log('No tokens loaded. Please authenticate first.');
            return;
        }

        // Get liked songs
        const likedTracks = await spotifyApi.getMySavedTracks({ limit: 50 });
        const trackUris = likedTracks.body.items.map(item => item.track.uri);

        // Replace playlist tracks
        const playlist = await spotifyApi.getPlaylist('0Rr8nCqR2E4yqRE9DdFmY9');
        await spotifyApi.replaceTracksInPlaylist(playlist.body.id, trackUris);
        console.log('Playlist updated successfully!');
        
    } catch (err) {
        if (err.message.includes('token expired')) {
            console.log('Access token expired. Refreshing...');
            // await refreshAccessToken(); // Refresh the token
            // return updatePlaylist(); // Retry the function
        }
        console.error('Error updating playlist:', err.message);
    }
};


// Schedule the job (Every Sunday at 12:00 PM)
// schedule.scheduleJob({ hour: 12, minute: 0, dayOfWeek: 0 }, async () => {
//     try {
//         await refreshAccessToken(); // Ensure the access token is valid
//         await updatePlaylist(); // Run the task
//     } catch (err) {
//         console.error('Error during scheduled job:', err.message);
//     }
// });

// Run immediately (for testing purposes)
updatePlaylist();

// Start the Express server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
