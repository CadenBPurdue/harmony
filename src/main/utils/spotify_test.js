const axios = require('axios');
const sqlite3 = require('sqlite3');

var PLAYLIST_ID = '7dNySe6is1ETaEBmDD5TPp';

class SpotifyApi {

    constructor() {
        this.token = null;
    }

    async initialize() {
        this.token = await SpotifyApi.getToken();
        if (!this.token) {
            throw new Error('Failed to get token');
        }
    }    

    static async getToken() {

        if (!process.env.CLIENT_SECRET) {
            throw new Error('Must set CLIENT_SECRET environment variable');
        }

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', '3852c03c669e46dd93e28ee6d4bd15c4');
        params.append('client_secret', process.env.CLIENT_SECRET);

        const response = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return response.data.access_token;
    }

    async getPlaylist() {

        if (!this.token) { 
            await this.initialize();
        }

        // get playlist
        // TODO: get playlist id from user input (or other source)
        const response = axios.get(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}`, {
            headers: { 'Authorization': `Bearer ${this.token}` }
        })
        .then((response) => {      
            this.storeMusic(response.data, 'playlist'); // store playlist
        }, (error) => {
            console.log(error);
        });
    }

    /* 
    Stores the imported music from Spotify into its respective table in the database:
    - each playlist will have its own table on the playlists database
    - each album will have its own table on the albums database
    */
    async storeMusic(musicObj, type) {
        var db = null;
        var table_name = null;
        if (type == 'playlist') {
            db = new sqlite3.Database('../db/playlists.db', (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
            table_name = musicObj.name;
        } else if (type == 'album') {
            db = new sqlite3.Database('../db/albums.db', (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
            table_name = musicObj.name;
        } else {
            throw new Error('Invalid type');
        }

        // validate and fix table name 
        table_name = table_name.replace(/[^a-zA-Z0-9]/g, '_');
        // TODO: add check for reserved keywords like SELECT or INSERT

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS ${table_name} (id INTEGER PRIMARY KEY, name TEXT, artist TEXT, uri TEXT, duration INTEGER)`);
        });

        musicObj.tracks.items.forEach((item) => {
            db.run(`INSERT INTO ${table_name} (name, artist, uri) VALUES (?, ?, ?)`, [item.track.name, item.track.artists[0].name, item.track.uri, item.track.duration_ms], (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        });
    }
}

let spotify = new SpotifyApi();
spotify.getPlaylist();