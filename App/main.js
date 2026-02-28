const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getRegistry, getRegistries, updateRegistries } = require('./src/sqlutils.js');

const app = express();

require('dotenv').config();

const PORT = process.env.port ?? 5000;
// Configuración de sesiones
app.use(session({
    secret: process.env.SESSION_SECRET || 'fs-avm-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 hora
}));

// Configurar EJS como motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, '/static/resources', 'favicon.ico'));
});

app.get('/', (req, res) => {
    res.render('layouts/index', { error: null, user: req.session.user });
});

app.route('/login')
    .get((req, res) => {
        if (req.session && req.session.user) {
            return res.redirect('/dashboard');
        }
        res.render('layouts/login', { error: null, user: req.session.user });
    })
    .post(async (req, res) => {
        const { name, password } = req.body;
        if (name && password) {
            const result = await getRegistries("SELECT PWordHash FROM Users WHERE Uname = ?", [name]);
            if (!result) {
                return res.render('layouts/login', { error: 'Usuario no encontrado', user: req.session.user });
            }
            const match = await bcrypt.compare(password, result[0].PWordHash);
            if (match) {
                req.session.user = name;
                req.session.userId = await getUserIdByName(name);
                return res.redirect('/dashboard');
            } else {
                return res.render('layouts/login', { error: 'Contraseña incorrecta', user: req.session.user });
            }
        }
        res.render('layouts/login', { error: 'Faltan datos', user: req.session.user });
    });

// Registro de usuario
app.route('/register')
    .get((req, res) => {
        res.render('layouts/register', { error: null, user: req.session.user });
    })
    .post(async (req, res) => {
        const { name, password } = req.body;
        if (name && password) {
            // Verificar si el usuario ya existe
            const exists = await getRegistries("SELECT Uname FROM Users WHERE Uname = ?", [name]);
            if (exists) {
                return res.render('layouts/register', { error: 'El usuario ya existe', user: req.session.user });
            }
            const hash = await bcrypt.hash(password, 10);
            await updateRegistries("INSERT INTO Users (Uname, PWordHash) VALUES (?, ?)", [name, hash]);
            return res.redirect('/login');
        }
        res.render('layouts/register', { error: 'Faltan datos', user: req.session.user });
    });

app.get('/dashboard', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) {
        return res.redirect('/login');
    }
    let groups = [];
    if (req.session.userId) {
        // include admin's name and total score (sum of all users' UMaxKills) for each group
        groups = await getRegistries(
            `SELECT g.GroupID,
                    g.Gname,
                    -- find the admin's username for the group
                    (SELECT u.Uname
                       FROM Users u
                       JOIN UserGroups ug2 ON u.UserID = ug2.UserID
                      WHERE ug2.GroupID = g.GroupID AND ug2.URole = 'admin'
                      LIMIT 1) AS adminName,
                    -- compute total score for the group
                    COALESCE((SELECT SUM(ug3.UMaxKills)
                                FROM UserGroups ug3
                               WHERE ug3.GroupID = g.GroupID), 0) AS totalScore
             FROM TeamGroups g
             JOIN UserGroups ug ON g.GroupID = ug.GroupID
             WHERE ug.UserID = ?`,
            [req.session.userId]
        ) || [];
    }
    res.render('layouts/dashboard', { user: req.session.user, userId: req.session.userId, groups });
});

// Página para crear grupo
app.get('/groups/create', (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    res.render('layouts/createGroup', { user: req.session.user, error: null });
});

// Lógica para crear grupo
app.post('/groups/create', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const { groupName } = req.body;
    if (!groupName) {
        return res.render('layouts/createGroup', { user: req.session.user, error: 'Nombre requerido' });
    }
    // Crear grupo y asociar usuario
    const userId = req.session.userId;
    const result = await updateRegistries("INSERT INTO TeamGroups (Gname) VALUES (?)", [groupName]);
    const groupId = result.insertId;
    await updateRegistries("INSERT INTO UserGroups (UserID, GroupID, URole, UStatus, UMaxKills) VALUES (?, ?, ?, ?, ?)", [userId, groupId, 2, 1, 0]);
    res.redirect('/dashboard');
});

// Página de grupo específico
app.get('/groups/:id', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const groupId = req.params.id;
    const group = await getRegistry("SELECT * FROM TeamGroups WHERE GroupID = ?", [groupId]);
    if (!group) return res.status(404).send('Grupo no encontrado');
    // Obtener usuarios del grupo y el rol del usuario en sesión
    let members = [];
    const membersInfo = await getRegistries("SELECT u.UserID, u.Uname, ug.URole, ug.UStatus, ug.UMaxKills FROM users u INNER JOIN usergroups ug ON u.UserID = ug.UserID WHERE ug.GroupID = ?;", [groupId])
    if (membersInfo) members = membersInfo; else members = [];
    const userId = req.session.userId;
    const userRole = await getRegistry("SELECT URole FROM usergroups WHERE UserID = ?", [userId])
    res.render('layouts/group', { user: req.session.user, userId, userRole, group, members, error: null });
});

// Borrar grupo
app.post('/groups/:id/delete', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const groupId = req.params.id;
    // Opcional: solo permitir borrar si el usuario pertenece al grupo
    const userId = req.session.userId;
    const isMember = await getRegistry("SELECT * FROM UserGroups WHERE UserID = ? AND GroupID = ?", [userId, groupId]);
    if (!isMember) return res.status(403).send('No autorizado para borrar este grupo');
    await updateRegistries("DELETE FROM TeamGroups WHERE GroupID = ?", [groupId]);
    await updateRegistries("DELETE FROM UserGroups WHERE GroupID = ?", [groupId]);
    res.redirect('/dashboard');
});

// Añadir usuario a grupo por ID y actualizar UStatus
app.post('/groups/:id/adduser', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const groupId = req.params.id;
    const uId = req.body.userId;
    const user = await getRegistry("SELECT * FROM Users WHERE UserID = ?", [uId]);
    // Verificar que el usuario existe>   
    if (!user) {
        return res.render('layouts/group', { user: req.session.user, userId, userRole, group, members, error: 'Usuario no encontrado' });
    }
    // Añadir a UserGroups si no existe
    const exists = await getRegistry("SELECT * FROM UserGroups WHERE UserID = ? AND GroupID = ?", [uId, groupId]);
    if (!exists) {
        await updateRegistries("INSERT INTO UserGroups (UserID, GroupID, URole, UStatus, UMaxKills) VALUES (?, ?, ?, ?, ?)", [uId, groupId, 1, 1, 0]);
    }
    // Refrescar datos
    const group = await getRegistry("SELECT * FROM TeamGroups WHERE GroupID = ?", [groupId]);
    if (!group) return res.status(404).send('Grupo no encontrado');
    let members = [];
    const membersInfo = await getRegistries("SELECT u.UserID, u.Uname, ug.GroupID, ug.URole, ug.UStatus, ug.UMaxKills FROM users u INNER JOIN usergroups ug ON u.UserID = ug.UserID WHERE ug.GroupID = ?;", [groupId])
    if (membersInfo) members = membersInfo; else members = [];
    const userId = req.session.userId;
    const userRole = await getRegistry("SELECT URole FROM usergroups WHERE UserID = ?", [userId])
    res.render('layouts/group', { user: req.session.user, userId, userRole, group, members, error: null });
});

app.post('/groups/:id/rmvuser/:uid', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const groupId = req.params.id;
    const uId = req.params.uid;
    // Verificar que el usuario existe>   
    if (!uId) return res.status(404).send("Usuario no encontrado")
    await updateRegistries("DELETE FROM UserGroups WHERE GroupID = ? AND UserID = ?", [groupId, uId]);
    if (Number(uId) === req.session.userId) return res.redirect("/dashboard")
    const group = await getRegistry("SELECT * FROM TeamGroups WHERE GroupID = ?", [groupId]);
    if (!group) return res.status(404).send('Grupo no encontrado');
    let members = [];
    const membersInfo = await getRegistries("SELECT u.UserID, u.Uname, ug.GroupID, ug.URole, ug.UStatus, ug.UMaxKills FROM users u INNER JOIN usergroups ug ON u.UserID = ug.UserID WHERE ug.GroupID = ?;", [groupId])
    if (membersInfo) members = membersInfo; else members = [];
    const userId = req.session.userId;
    const userRole = await getRegistry("SELECT URole FROM usergroups WHERE UserID = ?", [userId])
    res.render('layouts/group', { user: req.session.user, userId, userRole, group, members, error: null });

})

// Juego ligado a grupos: mostrar el juego dentro del contexto de un grupo
app.get('/groups/:id/game', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.redirect('/login');
    const groupId = req.params.id;
    const group = await getRegistry("SELECT * FROM TeamGroups WHERE GroupID = ?", [groupId]);
    if (!group) return res.status(404).send('Grupo no encontrado');
    // Verificar que el usuario pertenece al grupo
    const membership = await getRegistry("SELECT * FROM UserGroups WHERE UserID = ? AND GroupID = ?", [req.session.userId, groupId]);
    if (!membership) return res.status(403).send('No perteneces a este grupo');
    res.render('layouts/game', { user: req.session.user, userId: req.session.userId, group });
});

// Endpoint para registrar score (kills) por usuario en un grupo
app.post('/groups/:id/game/score', async (req, res) => {
    if (!req.session || !req.session.user || !req.session.userId) return res.status(401).json({ error: 'No autenticado' });
    const groupId = req.params.id;
    const userId = req.session.userId;
    const kills = parseInt(req.body.kills || 0, 10);
    if (isNaN(kills) || kills < 0) return res.status(400).json({ error: 'Kills inválidos' });
    const membership = await getRegistry("SELECT UMaxKills FROM UserGroups WHERE UserID = ? AND GroupID = ?", [userId, groupId]);
    if (!membership) return res.status(403).json({ error: 'No perteneces a este grupo' });
    const prev = membership.UMaxKills || 0;
    if (kills > prev) {
        await updateRegistries("UPDATE UserGroups SET UMaxKills = ? WHERE UserID = ? AND GroupID = ?", [kills, userId, groupId]);
    }
    return res.json({ ok: true, previous: prev, updated: Math.max(prev, kills) });
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Utilidad para obtener el UserID por nombre de usuario
async function getUserIdByName(name) {
    const result = await getRegistry("SELECT UserID FROM Users WHERE Uname = ?", [name]);
    return result ? result.UserID : null;
}

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});