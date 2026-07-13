/*
=========================================
OneChat
Static File Server
=========================================
*/

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5000;
const ROOT = __dirname;

const MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {

    let urlPath = decodeURIComponent(req.url.split("?")[0]);

    if(urlPath === "/"){
        urlPath = "/index.html";
    }

    const filePath = path.join(ROOT, urlPath);

    if(!filePath.startsWith(ROOT)){
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, data) => {

        if(err){
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>404 Not Found</h1>");
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache",
        });

        res.end(data);

    });

});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`OneChat static server running on port ${PORT}`);
});
