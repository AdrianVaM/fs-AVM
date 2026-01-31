const mysql = require('mysql2/promise');

async function getConnection() {
    return await mysql.createConnection({
        host: process.env.dbhost,
        database: process.env.database,
        user: process.env.user,
        password: process.env.password
    });
}

async function getRegistry(sql, query) {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(sql, query);
        if (rows.length === 0) {
            return null;
        }
        return rows[0];
    } catch (error) {
        console.error(error);
    } finally {
        if (connection) await connection.end();
    }
}

async function getRegistries(sql, query) {
    let connection;
    try {
        connection = await getConnection();
        const [rows] = await connection.execute(sql, query);
        if (rows.length === 0) {
            return null;
        }
        return rows;
    } catch (error) {
        console.error(error);
    } finally {
        if (connection) await connection.end();
    }
}

async function updateRegistries(sql, query) {
    let connection;
    try {
        connection = await getConnection();
        const [result] = await connection.execute(sql, query);
        return result;
    } catch (error) {
        console.error(error);
    } finally {
        if (connection) await connection.end();
    }
}

module.exports = {
    getRegistry,
    getRegistries,
    updateRegistries
};