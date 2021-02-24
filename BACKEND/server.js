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

let opencode = "ace3f49e28ab";
let linkopenfrontend = "https://" + opencode + ".ngrok.io";

let io = socketio(
  server,
  {
    cors: {
      origin: linklocalfrontend,
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

let connectiontedPeers = new Map();

// peers.on("connection", socket => {
io.on("connection", socket => {
  // console.log(socket.id);
  socket.emit("connection-success", { success: socket.id });

  connectiontedPeers.set(socket.id, socket);

  socket.on("disconnect", () => {
    // console.log("disconnected");
    connectiontedPeers.delete(socket.id);
  });

  socket.on("onlinePeers", data => {
    for (const [socketID, _socket] of connectiontedPeers.entries()) {
      if (socketID !== data.socketID) {
        console.log("online-peer", data.socketID, socketID);
        socket.emit("online-peer", socketID);
      }
    }
  });

  socket.on("offerOrAnswer", data => {
    for (const [socketID, socket] of connectiontedPeers.entries()) {
      if (socketID !== data.socketID) {
        // console.log(socketID, data.payload.type);
        socket.emit("offerOrAnswer", data.payload);
      }
    }
  });

  socket.on("candidate", data => {
    for (const [socketID, socket] of connectiontedPeers.entries()) {
      if (socketID !== data.socketID) {
        // console.log(socketID, data.payload);
        socket.emit("candidate", data.payload);
      }
    }
  });
});
