var http = require('http');
var fs = require('fs');
var path = require('path');
var root = 'F:\\02_ChatGPT Work\\06_XWork';
var port = 3020;
var MIME = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8'};
http.createServer(function(req,res){
  var u=req.url.split('?')[0];if(u==='/')u='/index.html';
  var fp=path.resolve(root+u);
  if(!fp.startsWith(root)){res.writeHead(403);res.end('');return;}
  if(fs.existsSync(fp)){var ct=MIME[path.extname(fp).toLowerCase()]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':ct});res.end(fs.readFileSync(fp));}
  else{res.writeHead(404);res.end('');}
}).listen(port,function(){console.log('OK:'+port);});