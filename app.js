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
  } catch (err) {
    res.status(400).send('Error during authentication: ' + err.message);
  }
});

// Update Playlist Function
const updatePlaylist = async () => {
  if (!userAccessToken) {
    console.log('No user authenticated.');
    return;
  }
  try {
    spotifyApi.setAccessToken(userAccessToken);

    // Get liked songs
    const likedTracks = await spotifyApi.getMySavedTracks({ limit: 50 });
    const trackUris = likedTracks.body.items.map(item => item.track.uri);

    // Get or create the playlist
    const user = await spotifyApi.getMe();
    const playlists = await spotifyApi.getUserPlaylists(user.body.id);
    let playlist = playlists.body.items.find(pl => pl.name === 'Liked Songs Weekly Update');

    if (!playlist) {
      playlist = await spotifyApi.createPlaylist(user.body.id, 'Liked Songs Weekly Update', {
        public: false,
      });
    }

    // Replace playlist tracks
    await spotifyApi.replaceTracksInPlaylist(playlist.id, trackUris);
    console.log('Playlist updated successfully!');
  } catch (err) {
    console.error('Error updating playlist:', err.message);
  }
};

// Schedule the job (Every Sunday at 12:00 PM)
schedule.scheduleJob({ hour: 12, minute: 0, dayOfWeek: 0 }, updatePlaylist);

// Start the Express server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
