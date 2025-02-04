const axios = require('axios').verbose();
const sqlite3 = require('sqlite3').verbose();

class SpotifyApi {

    constructor() {
        this.token = null;
        this.db = new sqlite3.Database('./src/main/db/spotify.db', (err) => {
            if (err) {
                console.error(err.message);
            }
        });
    }

    async initialize() {
        this.token = await SpotifyApi.getToken();
    }    

    static async getToken() {

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', '3852c03c669e46dd93e28ee6d4bd15c4');
        params.append('client_secret', 'secret');

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

        const response = axios.get('https://api.spotify.com/v1/playlists/7dNySe6is1ETaEBmDD5TPp/tracks', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        })
        .then((response) => {        
            console.log(response.data);
        }, (error) => {
            console.log(error);
        });
    }
}

let spotify = new SpotifyApi();
spotify.getPlaylist();