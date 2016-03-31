'use strict';

var WebSocketServer = require('ws').Server;
var WebSocket = require('ws');

var HOST = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1';
var PORT = process.env.OPENSHIFT_NODEJS_PORT || 8080;

// CloseEvent codes
var DATA_SYNTAX_ERROR = 4000;
var DATA_UNKNOWN_ATTRIBUTE = 4001;
var KEY_ALREADY_EXISTS = 4002;
var KEY_UNKNOWN = 4003;
var KEY_NO_LONGER_AVAILABLE = 4004;

var server = new WebSocketServer({ host: HOST, port: PORT }, function () {
  console.log('Server runs on: ' + HOST + ':' + PORT);
});

server.on('connection', function (socket) {
  socket.on('message', function (data) {
    var msg = void 0;
    try {
      msg = JSON.parse(data);
    } catch (event) {
      error(socket, DATA_SYNTAX_ERROR, 'Server accepts only JSON');
    }
    try {
      if (msg.hasOwnProperty('key')) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = server.clients[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var master = _step.value;

            if (master.key === msg.key) {
              error(socket, KEY_ALREADY_EXISTS, 'The key already exists');
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        socket.key = msg.key;
        socket.joiningClients = [];
      } else if (msg.hasOwnProperty('id')) {
        for (var index in socket.joiningClients) {
          if (index === msg.id.toString()) {
            socket.joiningClients[index].send(JSON.stringify({ data: msg.data }));
            return;
          }
        }
        socket.send(JSON.stringify({ id: msg.id, unavailable: true }));
      } else if (msg.hasOwnProperty('join')) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = server.clients[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _master = _step2.value;

            if (_master.key === msg.join) {
              console.log('master found');
              socket.master = _master;
              _master.joiningClients.push(socket);
              var id = _master.joiningClients.length - 1;
              _master.send(JSON.stringify({ id: id, data: msg.data }));
              return;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }

        error(socket, KEY_UNKNOWN, 'Unknown key');
      } else if (msg.hasOwnProperty('data') && socket.hasOwnProperty('master')) {
        var _id = socket.master.joiningClients.indexOf(socket);
        if (socket.master.readyState === WebSocket.OPEN) {
          socket.master.send(JSON.stringify({ id: _id, data: msg.data }));
        }
      } else {
        error(socket, DATA_UNKNOWN_ATTRIBUTE, 'Unsupported message format');
      }
    } catch (event) {
      error(socket, DATA_SYNTAX_ERROR, 'erver accepts only JSON');
    }
  });

  socket.on('close', function (event) {
    if (socket.hasOwnProperty('joiningClients')) {
      var _iteratorNormalCompletion3 = true;
      var _didIteratorError3 = false;
      var _iteratorError3 = undefined;

      try {
        for (var _iterator3 = socket.joiningClients[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
          var client = _step3.value;

          client.close(KEY_NO_LONGER_AVAILABLE, 'The peer is no longer available');
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion3 && _iterator3.return) {
            _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    }
  });
});

function error(socket, code, msg) {
  console.log('Error ' + code + ': ' + msg);
  socket.close(code, msg);
}

module.exports = server;
