const express = require('express');
const path = require('path');
const app = express();
const PORT = 5000;

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));


// Almacenar usuarios en memoria (solo para demo)
const users = [];

app.route('/form')
    .get((req, res) => {
        res.render('form', { users });
    })
    .post((req, res) => {
        const { name, password } = req.body;
        if (name && password) {
            users.push({ name, password });
        }
        res.render('form', { users });
    });

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});