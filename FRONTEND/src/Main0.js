import React, { Component } from "react";
import ioclient from "socket.io-client";
import Chat from "./Components/Chat";
import Daggable from "./Components/Draggable";
import Videos from "./Components/Videos";
import Video from "./Components/Video";

class Main extends Component {
  constructor(props) {
    super(props);

    this.state = {
      localStream: null,
      remoteStream: null,

      remoteStreams: [],
      peerConnections: {},
      selectedVideo: null,

      status: "Please wait...",

      pc_config: {
        iceServers: [
          {
            urls: "stun:stun.l.google.com:19302"
          }
        ]
      },

      sdpConstraints: {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      },

      messages: [],
      sendChannels: []
    };
  }

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
      audio: { echoCancellation: true },
      options: {
        mirror: true
      }
    };

    // navigator.mediaDevices
    //   .getDisplayMedia(constraints)
    //   .then(success)
    //   .catch(failure);

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      // const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      // success(screenTrack);
      // console.log("stream đó là: ", stream);
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

      const peerConnections = { ...this.state.peerConnections, [socketID]: pc };
      this.setState({
        peerConnections
      });

      pc.onicecandidate = e => {
        if (e.candidate) {
          this.sendToPeer("candidate", e.candidate, {
            local: this.socket.id,
            remote: socketID
          });
        }
      };

      // pc.oniceconnectionstatechange = e => {
      // if (pc.iceConnectionState === "disconnected") {
      //   const remoteStreams = this.state.remoteStreams.filter(
      //     stream => stream.id !== socketID
      //   );
      //   this.setState({
      //     remoteStream:
      //       (remoteStreams.length > 0 && remoteStreams[0].stream) || null
      //   });
      // }
      // };

      pc.ontrack = e => {
        let _remoteStream = null;
        let remoteStreams = this.state.remoteStreams;
        let remoteVideo = {};

        const rVideos = this.state.remoteStreams.filter(
          stream => stream.id === socketID
        );

        if (rVideos.length) {
          _remoteStream = rVideos[0].stream;
          _remoteStream.addTrack(e.track, _remoteStream);
          remoteVideo = {
            ...rVideos[0],
            stream: _remoteStream
          };
          remoteStreams = this.state.remoteStreams.map(_remoteVideo => {
            return (
              (_remoteVideo.id === remoteVideo.id && remoteVideo) ||
              _remoteVideo
            );
          });
        } else {
          _remoteStream = new MediaStream();
          _remoteStream.addTrack(e.track, _remoteStream);

          remoteVideo = {
            id: socketID,
            name: socketID,
            stream: _remoteStream
          };

          remoteStreams = [...this.state.remoteStreams, remoteVideo];
        }

        // const remoteVideo = {
        //   id: socketID,
        //   name: socketID,
        //   stream: e.streams[0]
        // };

        this.setState(prevState => {
          // const remoteStream =
          //   prevState.remoteStreams.length > 0
          //     ? {}
          //     : { remoteStream: e.streams[0] };

          const remoteStream =
            prevState.remoteStreams.length > 0
              ? {}
              : { remoteStream: _remoteStream };

          let selectedVideo = prevState.remoteStreams.filter(
            stream => stream.id === prevState.selectedVideo.id
          );
          selectedVideo = selectedVideo.length
            ? {}
            : { selectedVideo: remoteVideo };

          return {
            ...selectedVideo,
            ...remoteStream,
            remoteStreams
            // remoteStreams: [...prevState.remoteStreams, remoteVideo]
          };
        });
      };

      pc.close = () => {};

      if (this.state.localStream) {
        // pc.addStream(this.state.localStream);

        this.state.localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.state.localStream);
        });
      }

      callback(pc);
    } catch (e) {
      console.log("Something went wrong! pc not created!!", e);
      callback(null);
    }
  };

  componentDidMount = () => {
    const linklocalbackend = "http://localhost:8081";
    const linkpublicbackend = "https://735272f3b46.ngrok.io";

    this.socket = ioclient.connect(linklocalbackend, {
      withCredentials: true,
      extraHeaders: {
        "my-custom-header": "abcd"
      }
    });

    // this.socket = ioclient.connect("http://localhost:8081");

    this.socket.on("connection-success", data => {
      console.log("Đã kết nối !!!!");
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

    this.socket.on("online-peer", socketID => {
      console.log("ra socketID " + socketID);
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

    this.socket.on("candidate", data => {
      const pc = this.state.peerConnections[data.socketID];

      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });
  };

  switchVideo = _video => {
    this.setState({
      selectedVideo: _video
    });
  };

  render() {
    if (this.state.disconnected) {
      this.socket.close();
      this.state.localStream.getTracks().forEach(track => track.stop());
      return <div>You have successfully Disconnected</div>;
    }
    const statusText = (
      <div style={{ color: "yellow", padding: 5 }}>{this.state.status}</div>
    );

    return (
      <div>
        <Daggable
          style={{
            zIndex: 101,
            position: "absolute",
            right: 0,
            cursor: "move"
          }}
        >
          <Video
            videoStyle={{
              // zIndex: 2,
              // position: "absolute",
              // right: 0,
              width: 200
              // height: 200,
              // margin: 5,
              // backgroundColor: "black"
            }}
            frameStyle={{
              width: 200,
              margin: 5,
              borderRadius: 5,
              backgroundColor: "black"
            }}
            showMuteControls={true}
            videoStream={this.state.localStream}
            autoPlay
            muted
          ></Video>
        </Daggable>
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
            position: "absolute"
            // margin: 10,
            // backgroundColor: "#cdc4ff4f",
            // padding: 10,
            // borderRadius: 5
          }}
        >
          <div
            style={{
              margin: 10,
              backgroundColor: "#cdc4ff4f",
              padding: 10,
              borderRadius: 5
            }}
          >
            {statusText}
          </div>
        </div>
        <div>
          <Videos
            switchVideo={this.switchVideo}
            remoteStreams={this.state.remoteStreams}
          ></Videos>
        </div>
        <br />

        {/* <Chat
          user={{
            uid: (this.socket && this.socket.id) || ""
          }}
          messages={this.state.messages}
          sendMessage={message => {
            this.setState(prevState => {
              return { messages: [...prevState.messages, message] };
            });
            this.state.sendChannels.map(sendChannel => {
              sendChannel.readyState === "open" &&
                sendChannel.send(JSON.stringify(message));
            });
            this.sendToPeer("new-message", JSON.stringify(message), {
              local: this.socket.id
            });
          }}
        /> */}
      </div>
    );
  }
}

export default Main;
