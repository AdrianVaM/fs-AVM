const mysql = require('mysql2/promise')

const connection = await mysql.createConnection({
    host: process.env.dbhost,
    database: process.env.database,
    user: process.env.user,
    password: process.env.password
});

