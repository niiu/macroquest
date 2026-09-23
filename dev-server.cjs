const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'app.js', 'image-editor.js', 'graph-editor.js','graph-area.js','graph-navigation.js', 'path-editor.js', 'rules.js', 'zones.js', 'storage.js', 'saves.js','scene-layers.js','character-editor.js', 'html-export.js', 'style.css']);
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css'};
http.createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(name)) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, {'Content-Type':types[path.extname(name)]+'; charset=utf-8', 'Cache-Control':'no-store'});
  fs.createReadStream(path.join(__dirname,name)).pipe(response);
}).listen(4173, '127.0.0.1', () => console.log('Macroquest: http://127.0.0.1:4173'));
