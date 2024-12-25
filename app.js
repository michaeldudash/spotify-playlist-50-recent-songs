const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const schedule = require('node-schedule');

require('dotenv').config();

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI,
});


const app = express();

// In-memory token storage (use a database in production)
let userAccessToken = null;

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
    const code = req.query.code;
    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        userAccessToken = data.body['access_token'];
        spotifyApi.setAccessToken(userAccessToken);
        res.send('Authentication successful! You can now update playlists.');

        // Call updatePlaylist() after successful authentication
        updatePlaylist();
    } catch (err) {
        res.status(400).send('Error during authentication: ' + err.message);
    }
});

// Update Playlist Function
const updatePlaylist = async () => {
    console.log("updating playlist");
    if (!userAccessToken) {
        console.log('No user authenticated.');
        return;
    }
    try {
        console.log("correctly authenticated");
        spotifyApi.setAccessToken(userAccessToken);

        console.log("getting liked songs");
        // Get liked songs
        const likedTracks = await spotifyApi.getMySavedTracks({ limit: 50 });
        const trackUris = likedTracks.body.items.map(item => item.track.uri);

        console.log("creating or getting the playlist");
        // Get or create the playlist
        const user = await spotifyApi.getMe();
        const playlist = await spotifyApi.getPlaylist('0Rr8nCqR2E4yqRE9DdFmY9');
        console.log('playlist fetched: ', playlist);

        // Replace playlist tracks
        console.log('updating the playlist',trackUris);
        await spotifyApi.replaceTracksInPlaylist(playlist.body.id, trackUris);
        console.log('Playlist updated successfully!');
    } catch (err) {
        console.error('Error updating playlist:', err.message);
    }
};

// Schedule the job (Every Sunday at 12:00 PM)
schedule.scheduleJob({ hour: 12, minute: 0, dayOfWeek: 0 }, updatePlaylist);

// Run immediately (for testing purposes)
// updatePlaylist();

// Start the Express server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
