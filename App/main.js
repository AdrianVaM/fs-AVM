const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getRegistry, getRegistries, updateRegistries } = require('./src/sqlutils.js');

const app = express();

require('dotenv').config();
const PORT = process.env.port ?? 5000;

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));


// Almacenar usuarios en memoria (solo para demo)
const users = [];

app.route('/login')
    .get((req, res) => {
        res.render('layouts/login', { users });
    })
    .post(async (req, res) => {
        const { name, password } = req.body;
        if (name && password) {
            const result = await getRegistries("SELECT PWordHash FROM Users WHERE Uname = ?", [name]);
            if (!result) {
                return res.render('layouts/login', { users, error: 'Usuario no encontrado' });
            }
            const match = await bcrypt.compare(password, result[0].PWordHash);
            if (match) {
                return res.redirect('/test');
            } else {
                return res.render('layouts/login', { users, error: 'Contraseña incorrecta' });
            }
        }
        res.render('layouts/login', { users, error: 'Faltan datos' });
    });

// Registro de usuario
app.route('/register')
    .get((req, res) => {
        res.render('layouts/register', { users });
    })
    .post(async (req, res) => {
        const { name, password } = req.body;
        if (name && password) {
            // Verificar si el usuario ya existe
            const exists = await getRegistries("SELECT Uname FROM Users WHERE Uname = ?", [name]);
            if (exists) {
                return res.render('layouts/register', { users, error: 'El usuario ya existe' });
            }
            const hash = await bcrypt.hash(password, 10);
            await updateRegistries("INSERT INTO Users (Uname, PWordHash) VALUES (?, ?)", [name, hash]);
            return res.redirect('/login');
        }
        res.render('layouts/register', { users, error: 'Faltan datos' });
    });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates/layouts', 'index.html'));
});

app.get('/test', (req, res) => {
    res.send("hola mundo")
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});