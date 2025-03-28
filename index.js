// New express.js app
var QRCode = require('qrcode');
const express = require('express');
const session = require('express-session');
const app = express();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const storage = require('node-persist');
const { MongoClient } = require('mongodb');
require('dotenv').config();

storage.initSync();

// If /qr folder doesn't exist, create it
const fs = require('fs');
if (!fs.existsSync('./qr')) {
    fs.mkdirSync('./qr');
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const HTTP_PORT = process.env.PORT || 3000;

// Start server
app.listen(HTTP_PORT, () => {
  console.log(`Server running on port ${HTTP_PORT}`);
});

const sessions = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 60000,
        sameSite: true,
        httpOnly: true
    }
});

app.use(sessions);

app.get('/', (req, res) => {
    if(req.session.logged) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(__dirname + '/html/index.html');
    }
});

app.get('/dashboard', (req, res) => {
    if(req.session.logged) {
        res.sendFile(__dirname + '/html/dashboard.html');
    } else {
        res.redirect('/');
    }
});

app.get('/tailwind.css', (req, res) => {
    res.sendFile(__dirname + '/html/tailwind.css');
});

app.get('/geturls', async (req, res) => {
    let urls = await storage.getItem('urls');
    if(!urls || urls === undefined) {
        urls = [];
    }

    res.json(urls);
});

app.post('/add', async (req, res) => {
    if(!req.session.logged || req.session.logged !== true) {
        res.redirect('/');
        return;
    }

    let urls = await storage.getItem('urls');
    if(!urls || urls === undefined) {
        urls = [];
    }

    let code = generateCode();
    let long = null;
    if(req.body.windows || req.body.linux || req.body.mac || req.body.ios || req.body.android || req.body.chromeos) {
        long = {
            windows: req.body.windows || null,
            linux: req.body.linux || null,
            mac: req.body.macos || null,
            ios: req.body.ios || null,
            android: req.body.android || null,
            chromeos: req.body.chromeos || null,
            default: req.body.longurl || null
        };
    } else {
        long = {
            default: req.body.longurl || null
        };
    }

    let url = {
        code: code,
        short: 'https://' + process.env.FQDN + '/' + code,
        qr: 'https://' + process.env.FQDN + '/' + code + '/qr',
        long: long
    };

    urls.push(url);
    await storage.setItem('urls', urls);

    // Generate QR code and save it in /qr folder
    QRCode.toFile(__dirname + '/qr/' + code + '.png', url.short, {
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    });

    res.redirect('/dashboard?code=' + code + '&fqdn=' + process.env.FQDN);
});

function generateCode() {
    let code = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 8; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

app.delete('/delete/:id', async (req, res) => {
    if(!req.session.logged || req.session.logged !== true) {
        res.redirect('/');
        return;
    }

    let urls = await storage.getItem('urls');
    if(!urls || urls === undefined) {
        urls = [];
    }

    let id = req.params.id;
    let url = urls.find(element => element.short.split('/').pop() === id) || null;

    if(url === null) {
        res.redirect('/dashboard');
        return;
    }

    urls = urls.filter(element => element.short.split('/').pop() !== id);
    await storage.setItem('urls', urls);

    res.redirect('/dashboard');
});

app.get('/:id', async (req, res) => {
    const id = req.params.id;
    if(id === 'dashboard' || id === 'tailwind.css' || id === 'favicon.ico' || id === 'socket.io.js' || id === 'geturls' || id === 'add' || id === 'delete') return;

    // Get user's operating system
    const os = req.headers['user-agent'].split(') ')[0].split(' (')[1];

    let urls = await storage.getItem('urls');
    if(!urls || urls === undefined) {
        res.status(404).sendFile(__dirname + '/html/404.html');
        return;
    }

    let url = urls.find(element => element.short.split('/').pop() === id) || null;

    if(url === null) {
        res.status(404).sendFile(__dirname + '/html/404.html');
        return;
    }

    if(os.includes('Windows') && url.long.windows) {
        res.redirect(url.long.windows);
    } else if(os.includes('Linux') && url.long.linux) {
        res.redirect(url.long.linux);
    } else if(os.includes('Macintosh') && url.long.mac) {
        res.redirect(url.long.mac);
    } else if(os.includes('iPhone') && url.long.ios) {
        res.redirect(url.long.ios);
    } else if(os.includes('Android') && url.long.android) {
        res.redirect(url.long.android);
    } else if(os.includes('CrOS') && url.long.chromeos) {
        res.redirect(url.long.chromeos);
    } else {
        res.redirect(url.long.default);
    }
});

app.get('/:id/qr', async (req, res) => {
    // Download QR code
    const id = req.params.id;
    if(id === 'dashboard' || id === 'tailwind.css' || id === 'favicon.ico' || id === 'socket.io.js' || id === 'geturls' || id === 'add' || id === 'delete') return;

    const filePath = __dirname + '/qr/' + id + '.png';
    res.sendFile(filePath, {
        headers: {
            'Content-Disposition': 'attachment; filename="' + id + '.png"'
        }
    });
});

app.get('/:id/qr/embed', async (req, res) => {
    // Embed QR code in HTML
    const id = req.params.id;
    if(id === 'dashboard' || id === 'tailwind.css' || id === 'favicon.ico' || id === 'socket.io.js' || id === 'geturls' || id === 'add' || id === 'delete') return;

    res.sendFile(__dirname + '/qr/' + id + '.png');
});

        // let urls = [
        //     {
        //     "code": "ns7L3ns9",
        //     "short": "https://l.rabbitxone.tech/ns7L3ns9",
        //     "qr": "https://l.rabbitxone.tech/ns7L3ns9/qr",
        //     "long": {
        //         "default": "https://google.com/teapot"
        //     },
        //     },
        //     {
        //     "code": "3j9L3ns9",
        //     "short": "https://l.rabbitxone.tech/3j9L3ns9",
        //     "qr": "https://l.rabbitxone.tech/3j9L3ns9/qr",
        //     "long": {
        //         "windows": "https://google.com/tipot/",
        //         "chromeos": "https://gógl.com/tipot/",
        //     }
        //     },
        // ];


app.post('/login', async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    const hashedPassword = process.env.PASSWORD;
    if(username === process.env.LOGIN.trim() && bcrypt.compareSync(password, hashedPassword)) {
        req.session.logged = true;
        res.redirect('/dashboard');
    } else {
        res.redirect('/?error=true');
    }
});