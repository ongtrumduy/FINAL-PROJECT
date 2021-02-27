import React from "react";
import ioclient from "socket.io-client";

import Video from "./Components/Video";
import Videos from "./Components/Videos";

export default class Home extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null,
      remoteStream: null,

      remoteStreams: [],
      peerConnections: {},
      selectedVideo: null,

      status: "Please wait... ",

      pc_config: {
        iceServers: [
          {
            urls: "stun: stun.l.google.com:19302"
          }
        ]
      },

      sdpConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }
    };

    this.serviceIP = "192.168.1.194:8081";

    this.socket = null;
  }

  componentDidMount = () => {
    const linklocalbackend = "http://localhost:8081";
    const linkipbackend = "http://192.168.1.194:8081";

    const opencode = "84b521f97584";
    const linkopenbackend = "https://" + opencode + ".ngrok.io";

    this.socket = ioclient.connect(linklocalbackend, {
      withCredentials: true,
      extraHeaders: {
        "my-custom-header": "abcd"
      }
    });

    this.socket.on("connection-success", data => {
      this.getLocalStream();

      const status =
        data.peerCount > 1
          ? `Total Connected Peers: ${data.peerCount}`
          : "Waiting for other peers to connect";

      this.setState({
        status: status
      });
    });

    this.socket.on("peer-disconnected", data => {
      const remoteStreams = this.state.remoteStreams.filter(
        stream => stream.id !== data.socketID
      );

      this.setState(prevState => {
        const selectedVideo =
          prevState.selectedVideo.id === data.socketID && remoteStreams.length
            ? { selectedVideo: remoteStreams[0] }
            : null;

        return {
          remoteStreams,
          ...selectedVideo
        };
      });
    });

    this.socket.on("candidate", data => {
      const pc = this.state.peerConnections[data.socketID];

      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    this.socket.on("online-peer", socketID => {
      this.createPeerConnection(socketID, pc => {
        if (pc) {
          pc.createOffer(this.state.sdpConstraints).then(sdp => {
            pc.setLocalDescription(sdp);

            this.sendToPeer("offer", sdp, {
              local: this.socket.id,
              remote: socketID
            });
          });
        }
      });
    });

    this.socket.on("offer", data => {
      this.createPeerConnection(data.socketID, pc => {
        pc.addStream(this.state.localStream);

        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(
          () => {
            pc.createAnswer(this.state.sdpConstraints).then(sdp => {
              pc.setLocalDescription(sdp);

              this.sendToPeer("answer", sdp, {
                local: this.socket.id,
                remote: data.socketID
              });
            });
          }
        );
      });
    });

    this.socket.on("answer", data => {
      const pc = this.state.peerConnections[data.socketID];

      pc.setRemoteDescription(
        new RTCSessionDescription(data.sdp)
      ).then(() => {});
    });
  };

  getLocalStream = () => {
    const success = stream => {
      window.localStream = stream;
      this.setState({
        localStream: stream
      });

      this.whoisOnline();
    };

    const failure = e => {
      console.log("getUserMedia Error: ", e);
    };

    const constraints = {
      video: true,

      audio: false,
      option: {
        mirror: true
      }
    };

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      success(stream);
    })().catch(failure);
  };

  whoisOnline = () => {
    this.sendToPeer("onlinePeers", null, { local: this.socket.id });
  };

  sendToPeer = (messageType, payload, socketID) => {
    this.socket.emit(messageType, {
      socketID,
      payload
    });
  };

  createPeerConnection = (socketID, callback) => {
    try {
      let pc = new RTCPeerConnection(this.state.pc_config);

      const peerConnections = {
        ...this.state.peerConnections,
        [socketID]: pc
      };

      this.setState({
        peerConnections: peerConnections
      });

      pc.onicecandidate = e => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id,
            remote: socketID
          });
        }
      };

      pc.oniceconnectionstatechange = e => {};

      pc.ontrack = e => {
        const remoteVideo = {
          id: socketID,
          name: socketID,
          stream: e.streams[0]
        };

        this.setState(prevState => {
          const remoteStream =
            prevState.remoteStreams.length > 0
              ? {}
              : { remoteStream: e.streams[0] };
          let selectedVideo = prevState.remoteStreams.filter(
            stream => stream.id === prevState.selectedVideo.id
          );

          selectedVideo = selectedVideo.length
            ? {}
            : { selectedVideo: remoteVideo };

          return {
            ...selectedVideo,
            ...remoteStream,
            remoteStreams: [...prevState.remoteStreams, remoteVideo]
          };
        });
      };

      pc.close = () => {
        //alert("GONE")
      };

      if (this.state.localStream) {
        pc.addStream(this.state.localStream);
      }
      // return pc;
      callback(pc);
    } catch (e) {
      console.log("Something went wrong! pc not created!!", e);
      callback(null);
    }
  };

  switchVideo = _video => {
    this.setState({
      selectedVideo: _video
    });
  };

  render() {
    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{this.state.status}</div>
    );

    return (
      <div>
        <Video
          videoStyle={{
            zIndex: 2,
            position: "absolute",
            right: 0,
            width: 200,
            height: 200,
            margin: 5,
            backgroundColor: "black"
          }}
          videoStream={this.state.localStream}
          autoPlay
          muted
        ></Video>

        <Video
          videoStyle={{
            zIndex: 1,
            position: "fixed",
            bottom: 0,
            minWidth: "100%",
            minHeight: "100%",
            backgroundColor: "black"
          }}
          videoStream={
            this.state.selectedVideo && this.state.selectedVideo.stream
          }
          autoPlay
        ></Video>
        <br />
        <div
          style={{
            zIndex: 3,
            position: "absolute",
            margin: 10,
            backgroundColor: "#cdc4ff4f",
            padding: 10,
            borderRadius: 5
          }}
        >
          {statusText}
        </div>
        <div>
          <Videos
            switchVideo={this.switchVideo}
            remoteStreams={this.state.remoteStreams}
          ></Videos>
        </div>
        <br />
      </div>
    );
  }
}
