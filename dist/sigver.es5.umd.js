(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.sigver = global.sigver || {})));
}(this, (function (exports) { 'use strict';

var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var WebSocketServer = require('ws').Server;
var OPEN = require('ws').OPEN;

var MAX_ID = 4294967295;

// CloseEvent codes
var MESSAGE_TYPE_ERROR = 4000;
var MESSAGE_UNKNOWN_ATTRIBUTE = 4001;
var KEY_ALREADY_EXISTS = 4002;
var KEY_UNKNOWN = 4003;
var KEY_NO_LONGER_AVAILABLE = 4004;

var server = void 0;
var keyHolders = new Set();

function start(host, port) {
  var onStart = arguments.length <= 2 || arguments[2] === undefined ? function () {} : arguments[2];

  server = new WebSocketServer({ host: host, port: port }, function () {
    console.log('Server runs on: ' + host + ':' + port);
    onStart();
  });

  server.on('error', function (err) {
    console.error('Server error: ' + err);
  });

  server.on('connection', function (socket) {
    socket.on('close', function (err) {
      console.log('Socket closed: ' + err);
    });
    socket.on('message', function (data) {
      var msg = void 0;
      try {
        msg = JSON.parse(data);
      } catch (event) {
        error$1(socket, MESSAGE_TYPE_ERROR, 'Server accepts only JSON string');
      }
      try {
        if ('key' in msg) {
          if (keyExists(msg.key)) {
            socket.send('{"isKeyOk":false}');
            error$1(socket, KEY_ALREADY_EXISTS, 'The key ' + msg.key + ' exists already');
          } else {
            socket.send('{"isKeyOk":true}');
            socket.$connectingPeers = new Map();
            socket.$key = msg.key;
            keyHolders.add(socket);
            socket.on('close', function (code, errMsg) {
              console.log(msg.key + ' has been closed with code: ' + code + ' and message: ' + errMsg);
              keyHolders.delete(socket);
              socket.$connectingPeers.forEach(function (s) {
                s.close(KEY_NO_LONGER_AVAILABLE, msg.key + ' is no longer available');
              });
            });
          }
        } else if ('id' in msg && 'data' in msg) {
          var connectingPeer = socket.$connectingPeers.get(msg.id);
          if (connectingPeer) {
            socket.$connectingPeers.get(msg.id).send(JSON.stringify({ data: msg.data }));
          } else {
            console.log('The peer ' + msg.id + ' related to ' + socket.$key + ' key could not be found');
          }
        } else if ('join' in msg) {
          if (keyExists(msg.join)) {
            (function () {
              socket.send('{"isKeyOk":true}');
              socket.$keyHolder = getKeyHolder(msg.join);
              var peers = socket.$keyHolder.$connectingPeers;
              var id = generateId(peers);
              peers.set(id, socket);
              socket.on('close', function (code, errMsg) {
                console.log(id + ' socket retlated to ' + msg.join + ' key has been closed with code: ' + code + ' and message: ' + errMsg);
                if (socket.$keyHolder.readyState === OPEN) {
                  socket.$keyHolder.send(JSON.stringify({ id: id, unavailable: true }));
                }
                peers.delete(id);
              });
              if ('data' in msg) {
                socket.$keyHolder.send(JSON.stringify({ id: id, data: msg.data }));
              }
            })();
          } else {
            socket.send('{"isKeyOk":false}');
            error$1(socket, KEY_UNKNOWN, 'Unknown key: ' + msg.join);
          }
        } else if ('data' in msg) {
          if ('$keyHolder' in socket) {
            var _id = void 0;
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = socket.$keyHolder.$connectingPeers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var _step$value = slicedToArray(_step.value, 2);

                var key = _step$value[0];
                var value = _step$value[1];

                if (value === socket) {
                  _id = key;
                  break;
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

            if (socket.$keyHolder.readyState === OPEN) socket.$keyHolder.send(JSON.stringify({ id: _id, data: msg.data }));
          } else {
            console.log('The client has not been assigned yet to a keyHolder');
          }
        } else {
          error$1(socket, MESSAGE_UNKNOWN_ATTRIBUTE, 'Unknown JSON attribute: ' + data);
        }
      } catch (err) {
        error$1(socket, err.code, err.message);
      }
    });

    socket.on('error', function (err) {
      return console.log('Socket ERROR: ' + err);
    });
  });
}

function stop() {
  console.log('Server has stopped successfully');
  server.close();
}

function error$1(socket, code, msg) {
  console.trace();
  console.log('Error ' + code + ': ' + msg);
  socket.close(code, msg);
}

function keyExists(key) {
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = keyHolders[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var h = _step2.value;
      if (h.$key === key) return true;
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

  return false;
}

function getKeyHolder(key) {
  var _iteratorNormalCompletion3 = true;
  var _didIteratorError3 = false;
  var _iteratorError3 = undefined;

  try {
    for (var _iterator3 = keyHolders[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
      var h = _step3.value;
      if (h.$key === key) return h;
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

  return null;
}

function generateId(peers) {
  var id = void 0;
  do {
    id = Math.ceil(Math.random() * MAX_ID);
    if (peers.has(id)) continue;
    break;
  } while (true);
  return id;
}

exports.start = start;
exports.stop = stop;

Object.defineProperty(exports, '__esModule', { value: true });

})));