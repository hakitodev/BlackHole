const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');

db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    balance INTEGER DEFAULT 0
  )
`);

function getUser(id, callback) {
  db.get(`SELECT * FROM users WHERE id = ?`, [id], (err, row) => {
    if (row) return callback(row);

    db.run(`INSERT INTO users (id, balance) VALUES (?, 0)`, [id], () => {
      callback({ id, balance: 0 });
    });
  });
}

function addMoney(id, amount) {
  db.run(`
    UPDATE users
    SET balance = balance + ?
    WHERE id = ?
  `, [amount, id]);
}

function removeMoney(id, amount) {
  db.run(`
    UPDATE users
    SET balance = balance - ?
    WHERE id = ?
  `, [amount, id]);
}

module.exports = {
  getUser,
  addMoney,
  removeMoney
};
