const https = require('https');

const API_TOKEN = 'bb2a453c9bad4f5f922327edb07fd22b';

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'X-Auth-Token': API_TOKEN } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function start() {
    try {
        const pd = await fetchUrl('https://api.football-data.org/v4/competitions/PD/teams');
        const sd = await fetchUrl('https://api.football-data.org/v4/competitions/SD/teams');

        const valladolid = pd.teams ? pd.teams.find(t => t.name.includes('Valladolid')) : null;
        const racing = sd.teams ? sd.teams.find(t => t.name.includes('Racing Santander') || t.shortName === 'Racing') : null;

        console.log('Valladolid ID:', valladolid ? valladolid.id : 'Not Found');
        console.log('Racing ID:', racing ? racing.id : 'Not Found');
    } catch (e) {
        console.error(e);
    }
}

start();
