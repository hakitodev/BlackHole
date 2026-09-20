const http = require("http");

const port = Number(process.env.PORT) || 3000;

http.createServer((req, res) => {
    if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
        return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("BlackHole Bot is running");
}).listen(port, () => {
    console.log(`Keep-alive server started on port ${port}`);
});

require("./index.js");
