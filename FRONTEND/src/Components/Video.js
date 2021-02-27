import React from "react";

export default class Video extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount = () => {
    if (this.props.videoStream) {
      this.video.srcObject = this.props.videoStream;
    }
  };

  componentWillReceiveProps(nextProps) {
    // this.video.srcObject = nextProps.videoStream;
    console.log(nextProps.videoStream);

    if (
      nextProps.videoStream &&
      nextProps.videoStream !== this.props.videoStream
    ) {
      this.video.srcObject = nextProps.videoStream;
    }
  }

  render() {
    return (
      <div style={{ ...this.props.frameStyle }}>
        <video
          id={this.props.id}
          muted={this.props.muted}
          autoPlay
          style={{ ...this.props.videoStyle }}
          //   ref={this.props.videoRef}
          ref={ref => {
            this.video = ref;
          }}
        ></video>
      </div>
    );
  }
}
