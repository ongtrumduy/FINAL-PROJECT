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
          // {
          //   urls: "stun[STUN-IP]:[PORT]",
          //   credential: "[YOUR CREDENTIAL]",
          //   username: "[USERNAME]"
          // },
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

    //https://reatjc.org/docs/refs-and-the-dom.html
    // this.localVideoref = React.createRef();
    // this.remoteVideoref = React.createRef();

    this.socket = null;
    // this.candidates = [];
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
      // path: "/webrtc",
      // query: {}
    });

    // this.socket.on("connection-success", success => {
    //   console.log(success);
    // });

    this.socket.on("connection-success", data => {
      this.getLocalStream();

      // console.log(data.success);
      const status =
        data.peerCount > 1
          ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
          : "Waiting for other peers to connect";

      this.setState({
        status: status
      });
    });

    this.socket.on("joined-peers", data => {
      this.setState({
        status:
          data.peerCount > 1
            ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
            : "Waiting for other peers to connect"
      });
    });

    this.socket.on("peer-disconnected", data => {
      console.log("peer-disconnected", data);

      const remoteStreams = this.state.remoteStreams.filter(
        stream => stream.id !== data.socketID
      );

      this.setState(prevState => {
        const selectedVideo =
          prevState.selectedVideo.id === data.socketID && remoteStreams.length
            ? { selectedVideo: remoteStreams[0] }
            : null;

        return {
          // remoteStream:
          //   (remoteStreams.length > 0 && remoteStreams[0].stream) || null,
          remoteStreams,
          ...selectedVideo,
          status:
            data.peerCount > 1
              ? `Total Connected Peers to room ${window.location.pathname}: ${data.peerCount}`
              : "Waiting for other peers to connect"
        };
      });
    });

    // this.socket.on("offerOrAnswer", sdp => {
    //   this.textref.value = JSON.stringify(sdp);

    //   this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    // });

    // this.socket.on("candidate", candidate => {
    this.socket.on("candidate", data => {
      // console.log("From peer... ", JSON.stringify(candidate));
      // this.candidates = [...this.candidates, candidate];

      const pc = this.state.peerConnections[data.socketID];

      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }

      // this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    this.socket.on("online-peer", socketID => {
      // console.log("connected peers ...", socketID);

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
      // const pc = this.createPeerConnection(data.socketID);
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

  // const pc_config = null;

  // this.pc = new RTCPeerConnection(null);

  // this.pc = new RTCPeerConnection(this.state.pc_config);

  // this.pc.onicecandidate = e => {
  //   if (e.candidate) {
  //     // console.log(JSON.stringify(e.candidate));F
  //     this.sendToPeer("candidate", e.candidate);
  //   }
  // };

  // this.pc.oniceconnectionstatechange = e => {
  //   console.log(e);
  // };

  // this.pc.onaddstream = e => {
  //   this.remoteVideoref.current.srcObject = e.stream;
  // };

  //   this.pc.ontrack = e => {
  //     // this.remoteVideoref.current.srcObject = e.streams[0];

  //     this.setState({
  //       remoteStream: e.streams[0]
  //     });
  //   };
  // };

  getLocalStream = () => {
    const success = stream => {
      window.localStream = stream;
      // this.localVideoref.current.srcObject = stream;
      // this.pc.addStream(stream);
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
      // video: { width: 1280, height: 720 },
      // video: { width: { min: 1280 } },
      audio: false,
      option: {
        mirror: true
      }
    };

    // navigator.getUserMedia(constraints, success, failure);

    // navigator.mediaDevices
    //   .getUserMedia(constraints)
    //   .then(success)
    //   .catch(failure);

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      success(stream);
    })().catch(failure);
  };

  whoisOnline = () => {
    // let all peers know I am joining
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

      pc.oniceconnectionstatechange = e => {
        // if (pc.iceConnectionState === "disconnected") {
        //   const remoteStreams = this.state.remoteStreams.filter(
        //     stream => stream.id !== socketID
        //   );
        //   this.setState({
        //     remoteStreams:
        //       (remoteStreams.length > 0 && remoteStreams[0].stream) || null
        //   });
        // }
      };

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
            // selectedVideo: remoteVideo,
            // remoteStream: e.streams[0],
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

  // createOffer = () => {
  //   console.log("Offer");
  //   // this.pc.createOffer({ offerToReceiveVideo: 1 }).then(
  //   this.pc.createOffer(this.state.sdpConstraints).then(
  //     sdp => {
  //       // console.log(JSON.stringify(sdp));
  //       this.pc.setLocalDescription(sdp);

  //       this.sendToPeer("offerOrAnswer", sdp);
  //     },
  //     e => {}
  //   );
  // };

  // createAnswer = () => {
  //   console.log("Answer");
  //   this.pc.createAnswer(this.state.sdpConstraints).then(sdp => {
  //     // console.log(JSON.stringify(sdp));
  //     this.pc.setLocalDescription(sdp);

  //     this.sendToPeer("offerOrAnswer", sdp);
  //   });
  // };

  // setRemoteDescription = () => {
  //   const desc = JSON.parse(this.textref.value);

  //   this.pc.setRemoteDescription(new RTCSessionDescription(desc));
  // };

  // addCandidate = () => {
  //   // const candidate = JSON.parse(this.textref.value);
  //   // console.log("Adding candidate: ", candidate);

  //   // this.pc.addIceCandidate(new RTCIceCandidate(candidate));

  //   this.candidates.forEach(candidate => {
  //     console.log(JSON.stringify(candidate));
  //     this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  //   });
  // };

  switchVideo = _video => {
    // console.log(_video);
    this.setState({
      selectedVideo: _video
    });
  };

  render() {
    // console.log(this.state.localStream);

    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{this.state.status}</div>
    );

    return (
      <div>
        {/* <Video */}
        <Video
          // videoStyles={{
          videoStyle={{
            zIndex: 2,
            position: "absolute",
            right: 0,
            width: 200,
            height: 200,
            margin: 5,
            backgroundColor: "black"
          }}
          // ref={this.localVideoref}
          videoStream={this.state.localStream}
          autoPlay
          muted
          // controls
          // ></Video>
        ></Video>
        {/* <video
          style={{F
            width: 240,
            height: 240,
            margin: 5,
            backgroundColor: "black"
          }}
          ref={this.remoteVideoref}
          autoPlay
        ></video> */}
        <Video
          videoStyle={{
            zIndex: 1,
            position: "fixed",
            bottom: 0,
            minWidth: "100%",
            minHeight: "100%",
            backgroundColor: "black"
          }}
          // ref={this.remoteVideoref}
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

        {/* <div style={{ zIndex: 1, position: "fixed" }}>
          <button onClick={() => this.createOffer()}>Offer</button>
          <button onClick={() => this.createAnswer()}>Answer</button>
          <br />
          <textarea
            style={{ width: 450, height: 40 }}
            ref={ref => {
              this.textref = ref;
            }}
          />
        </div> */}

        {/* <br />
          <button onClick={() => this.setRemoteDescription()}>
            Set Remote Desc
          </button>
          <button onClick={() => this.addCandidate()}>Add Candidate</button> */}
      </div>
    );
  }
}
