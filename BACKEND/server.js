import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import http from "http";
import socketio from "socket.io";
import events from "events";
import multer from "multer";
import path from "path";
import { v4 as uuidV4 } from "uuid";

let app = express();
let server = http.Server(app);
let port = 8081;
let linklocalfrontend = "http://localhost:3000";
// let linkipfrontend = "http://192.168.1.194:3000";

let opencode = "ace3f49e28ab";
let linkopenfrontend = "https://" + opencode + ".ngrok.io";

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

server
  .listen(port, () => {
    console.log(`Listening on the port ${port}`);
  })
  .on("error", e => {
    console.error(e);
  });

// const peers = io.of("/webrtcPeer");

let connectedPeers = new Map();

// peers.on("connection", socket => {
io.on("connection", socket => {
  connectedPeers.set(socket.id, socket);

  console.log(connectedPeers.size);

  // console.log(socket.id);
  socket.emit("connection-success", {
    success: socket.id,
    peerCount: connectedPeers.size
  });

  // const broadcast = () => {
  socket.broadcast.emit("joined-peer", {
    peerCount: connectedPeers.size
  });
  // };
  // broadcast();

  const disconnectedPeer = socketID =>
    socket.broadcast.emit("peer-disconnected", {
      peerCount: connectedPeers.size,
      socketID: socketID
    });

  socket.on("disconnect", () => {
    console.log("disconnected");
    console.log(socket.id);
    connectedPeers.delete(socket.id);
    disconnectedPeer(socket.id);
  });

  socket.on("onlinePeers", data => {
    // console.log("onlinePeers", data);
    for (const [socketID, _socket] of connectedPeers.entries()) {
      if (socketID !== data.socketID.local) {
        // console.log("online-peer", data.socketID, socketID);
        socket.emit("online-peer", socketID);
      }
    }
  });

  socket.on("offer", data => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        // console.log(socketID, data.payload.type);
        socket.emit("offer", {
          sdp: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });

  socket.on("answer", data => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        // console.log(socketID, data.payload.type);
        socket.emit("answer", {
          sdp: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });

  // socket.on("offerOrAnswer", data => {
  //   for (const [socketID, socket] of connectedPeers.entries()) {
  //     if (socketID !== data.socketID) {
  //       // console.log(socketID, data.payload.type);
  //       socket.emit("offerOrAnswer", data.payload);
  //     }
  //   }
  // });

  socket.on("candidate", data => {
    for (const [socketID, socket] of connectedPeers.entries()) {
      if (socketID === data.socketID.remote) {
        // console.log(socketID, data.payload);
        socket.emit("candidate", {
          candidate: data.payload,
          socketID: data.socketID.local
        });
      }
    }
  });
});
