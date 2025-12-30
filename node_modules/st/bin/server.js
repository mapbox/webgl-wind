#!/usr/bin/env node
var st = require('../st.js')
var http = require('http')
var port = +(process.env.PORT || 1337)
var host = undefined
var dir = ''
var url = '/'
var cacheSize = 0
var dot = false
var index = true
var cache = true
var age = null
var cors = false

for (var i = 2; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-p':
    case '--port':
      port = +(process.argv[++i])
      break

    case '-H':
    case '--host':
      host = process.argv[++i]
      if (host === '*') {
        host = undefined
      }
      break

    case '-l':
    case '--localhost':
      host = 'localhost'
      break

    case '-d':
    case '--dir':
      dir = process.argv[++i]
      break

    case '-u':
    case '--url':
      url = process.argv[++i]
      break

    case '-.':
    case '--dot':
      dot = process.argv[++i]
      if (dot === undefined || dot === 'true') dot = true
      else if (dot === 'false') dot = false
      else if (dot.charAt(0) === '-') {
        --i
        dot = true
      }
      break

    case '-n.':
    case '--no-dot':
      dot = false
      break

    case '-i':
    case '--index':
      index = process.argv[++i]
      if (index === undefined || index === 'true') index = true
      if (index === 'false') index = false
      if (index.charAt(0) === '-') {
        --i
        index = true
      }
      break

    case '-ni':
    case '--no-index':
      index = false
      break

    case '-h':
    case '--help':
      help()
      process.exit(0)

    case '-nc':
    case '--no-cache':
      cache = false
      break

    case '-a':
    case '--age':
      age = process.argv[++i]
      if (isNaN(age)) {
        throw new Error('invalid age: ' + JSON.stringify(age))
      }
      age = +age
      break

    case '-co':
    case '--cors':
      cors = true;
      break
  }
}

function help () {
  console.log(
['st'
,'Static file server in node'
,''
,'Options:'
,''
,'-h --help             Show this help'
,''
,'-p --port PORT        Listen on PORT (default=1337)'
,''
,'-H --host HOST        Bind address HOST (default=*)'
,''
,'-l --localhost        Same as "--host localhost"'
,''
,'-d --dir DIRECTORY    Serve the contents of DIRECTORY (default=cwd)'
,''
,'-u --url /url         Serve at this mount url (default=/)'
,''
,'-i --index [INDEX]    Use the specified INDEX filename as the result'
,'                      when a directory is requested.  Set to "true"'
,'                      to turn autoindexing on, or "false" to turn it'
,'                      off.  If no INDEX is provided, then it will turn'
,'                      autoindexing on.  (default=true)'
,''
,'-ni --no-index        Same as "--index false"'
,''
,'-. --dot [DOT]        Allow .files to be served.  Set to "false" to'
,'                      disable.'
,''
,'-n. --no-dot          Same as "--dot false"'
,''
,'-co --cors            Enable CORS to serve files to any domain.'
,''
,'-nc --no-cache        Turn off all caching.'
,''
,'-a --age AGE          Max age (in ms) of cache entries.'
].join('\n'))
}

if (isNaN(port)) throw new Error('invalid port: '+port)

var opt = {
  path: dir,
  url: url,
  index: index,
  dot: dot,
  cache: {
    fd: {},
    stat: {},
    index: {},
    readdir: {},
    content: {}
  },
  cors: cors
}

if (cache === false) {
  opt.cache = false
} else {
  if (age) {
    Object.keys(opt.cache).forEach(function (k) {
      opt.cache[k].maxAge = age
    })
  }
  // maybe other cache-manipulating CLI flags?
}

var mount = st(opt)

http.createServer(function (q, s) {
  if (mount(q, s)) return
  s.statusCode = 404
  s.end('not found')
}).listen(port, host, function() {
  var addr = this.address()
  var port = addr.port
  if (!host) {
    host = addr.address
  }
  if (/:/.test(host)) {
    host = '[' + host + ']'
  }
  console.log('listening at http://' + host + ':' + port)
})
