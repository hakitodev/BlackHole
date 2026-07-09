const { Client } = require('discord.js');
const http = require('http');

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('BlackHole Bot is running!');
}).listen(process.env.PORT || 3000);

console.log(`Keep-alive server started on port ${process.env.PORT || 3000}`);

require('./index.js');
