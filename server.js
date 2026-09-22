const http = require("http");
const { handleRequest } = require("./Web/app");
const { client, startBot } = require("./index.js");

const port = Number(process.env.PORT) || 3000;

http.createServer((req, res) => {
    handleRequest(req, res, client).catch(error => {
        console.error(error);
        if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        }
        res.end("Internal error");
    });
}).listen(port, () => {
    console.log(`Сайт: http://localhost:${port}`);
});

startBot().catch(error => {
    console.error("Ошибка запуска бота:", error);
});
