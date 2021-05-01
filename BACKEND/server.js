import bodyParser from "body-parser";
import cors from "cors";
import events from "events";
import express from "express";
import http from "http";
import socketio from "socket.io";

let app = express();
let server = http.Server(app);
let port = 8081;
let linklocalfrontend = "http://localhost:3000";
// let linkipfrontend = "http://192.168.1.194:3000";

let opencode = "ace3f49e28ab";
let linkopenfrontend = "https://" + opencode + ".ngrok.io";

let rooms = {};
const messages = {};

let io = socketio(
  server,
  {
    cors: {
      origin: [linklocalfrontend],
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"],
      credentials: true
    }
  }
  // },
  // {
  //   path: "/webrtc"
  // }
);

app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let corsOptions = {
  body: "*",
  origin: "*",
  optionsSuccessStatus: 200
};

events.EventEmitter.defaultMaxListeners = 6969696969696969696969696969696969696969696969696969;

// app.get("/join", (req, res) => {
//   res.send({ link: uuidV4() });
// });

app.get("/:room", (req, res, next) => {});

server
  .listen(port, () => {
    console.log(`Listening on the port ${port}`);
  })
  .on("error", e => {
    console.error(e);
  });

// const peers = io.of("/webrtcPeer");

// let connectedPeers = new Map();

// peers.on("connection", socket => {
io.on("connection", socket => {
  const room = socket.handshake.query.room;

  rooms[room] =
    (rooms[room] && rooms[room].set(socket.id, socket)) ||
    new Map().set(socket.id, socket);
  messages[room] = messages[room] || [];

  // connectedPeers.set(socket.id, socket)

  // console.log(socket.id);
  socket.emit("connection-success", {
    success: socket.id,
    peerCount: rooms[room].size,
    messages: messages[room]
  });

  // const broadcast = () => socket.broadcast.emit('joined-peers', {
  //   peerCount: connectedPeers.size,
  // })
  const broadcast = () => {
    const _connectedPeers = rooms[room];

    for (const [socketID, _socket] of _connectedPeers.entries()) {
      // if (socketID !== socket.id) {
      _socket.emit("joined-peers", {
        peerCount: rooms[room].size //connectedPeers.size,
      });
      // }
    }
  };
  broadcast();

  // const disconnectedPeer = (socketID) => socket.broadcast.emit('peer-disconnected', {
  //   peerCount: connectedPeers.size,
  //   socketID: socketID
  // })
  const disconnectedPeer = socketID => {
    const _connectedPeers = rooms[room];
    for (const [_socketID, _socket] of _connectedPeers.entries()) {
      _socket.emit("peer-disconnected", {
        peerCount: rooms[room].size,
        socketID
      });
    }
  };

  socket.on("new-message", data => {
    // console.log("new-message", JSON.parse(data.payload));

    messages[room] = [...messages[room], JSON.parse(data.payload)];
  });

  socket.on("disconnect", () => {
    console.log("disconnected");
    // connectedPeers.delete(socket.id)
    rooms[room].delete(socket.id);
    messages[room] = rooms[room].size === 0 ? null : messages[room];
    disconnectedPeer(socket.id);
  });

  socket.on("onlinePeers", data => {
    const _connectedPeers = rooms[room];
    for (const [socketID, _socket] of _connectedPeers.entries()) {
      // don't send to self
      if (socketID !== data.socketID.local) {
        // console.log("online-peer", data.socketID, socketID);
        socket.emit("online-peer", socketID);
      }
    }
  });

  socket.on("offer", data => {
    const _connectedPeers = rooms[room];
    for (const [socketID, socket] of _connectedPeers.entries()) {
      // don't send to self
      if (socketID === data.socketID.remote) {
        // console.log('Offer', socketID, data.socketID, data.payload.type)
        socket.emit("offer", {
          sdp: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });

  socket.on("answer", data => {
    const _connectedPeers = rooms[room];
    for (const [socketID, socket] of _connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        // console.log("Answer", socketID, data.socketID, data.payload.type);
        socket.emit("answer", {
          sdp: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });

  // socket.on('offerOrAnswer', (data) => {
  //   // send to the other peer(s) if any
  //   for (const [socketID, socket] of connectedPeers.entries()) {
  //     // don't send to self
  //     if (socketID !== data.socketID) {
  //       console.log(socketID, data.payload.type)
  //       socket.emit('offerOrAnswer', data.payload)
  //     }
  //   }
  // })

  socket.on("candidate", data => {
    const _connectedPeers = rooms[room];
    // send candidate to the other peer(s) if any
    for (const [socketID, socket] of _connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        socket.emit("candidate", {
          candidate: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });
});
