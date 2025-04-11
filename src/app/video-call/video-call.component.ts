import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from '../core/services/user.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-video-call',
  templateUrl: './video-call.component.html',
  styleUrls: ['./video-call.component.scss']
})
export class VideoCallComponent implements OnInit, OnDestroy {
  @ViewChild("myVideo") myVideo!: ElementRef;
  @ViewChild("userVideo") userVideo!: ElementRef;

  receiverId!: string;
  isScreenSharing: boolean = false;
  isVideoEnabled: boolean = true;
  callInProgress = false;
  isMuted: boolean = false;
  callType: 'audio' | 'video' = 'video';
  private myStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun.l.google.com:5349" },
      { urls: "stun:stun1.l.google.com:3478" },
      { urls: "stun:stun1.l.google.com:5349" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:5349" },
      { urls: "stun:stun3.l.google.com:3478" },
      { urls: "stun:stun3.l.google.com:5349" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:5349" },
      {
        urls: "stun:stun.l.google.com:19302",
        credential: "kushal123",
        username: "kushal123"
      },
      {
        urls: "stun:stun.l.google.com:19302",
        credential: "kushal124",
        username: "kushal124"
      }
    ]
  };
  private previousStreams: MediaStream[] = [];
  private screenStream: MediaStream | null = null;
  isCallInitiator = false;
  private mediaRecorder!: MediaRecorder;
  private recordedChunks: Blob[] = [];
  isRecording = false;
  recordedVideoUrl: string | null = null;
  private destroy$ = new Subject<void>();
  private callStartTime!: Date;
  private callDuration = 0;
  private callTimer: any;


  localVideoActive = false;
  remoteVideoActive = false;
  localUserAvatar!: string;
  remoteUserAvatar!: string;
  remoteUserName!: string;

  constructor(
    public authService: AuthService,
    private socketService: SocketService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
  ) { }


  ngOnInit(): void {
    this.receiverId = this.route.snapshot.params['receiverId'];
    this.callType = this.route.snapshot.queryParams['callType'];

    this.isCallInitiator = !!this.receiverId;
    if (this.isCallInitiator) {
      if (this.callType === 'video') {
        this.callVideoUser();
      } else {
        this.callAudioUser();
      }
    }
    this.listenForCalls();
    this.loadRemoteUserInfo(this.receiverId);
    this.localUserAvatar = this.authService.getLoggedInUser().avatar;
    
    this.socketService.onCallEnded()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.toastr.info('Call ended by the other party', '', { timeOut: 2000 });
        this.endCall();
      });

    this.socketService.onCallRejected()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.toastr.info('Call was rejected', '', { timeOut: 2000 });
        this.endCall();
      });

    this.startCallTimer();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.endCall();
    window.removeEventListener('beforeunload', this.endCall.bind(this));

    window.addEventListener('beforeunload', (e) => {
      this.endCall();
      e.returnValue = '';
    });
  }

  onRemoteVideoPlaying() {
    this.remoteVideoActive = true;
  }

  onLocalVideoPlaying() {
    this.localVideoActive = true;
  }

  private startCallTimer() {
    this.callStartTime = new Date();
    this.callTimer = setInterval(() => {
      this.callDuration = Math.floor((new Date().getTime() - this.callStartTime.getTime()) / 1000);
    }, 1000);
  }


  private loadRemoteUserInfo(userId: string) {
    this.userService.getUserById(userId).subscribe({
      next: (user: any) => {
        this.remoteUserAvatar = user.data.avatar;
        this.remoteUserName = user.data.username;
      },
      error: (error) => {
        this.toastr.error(`Failed to load local user info: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
      }
    });
  }

  async callVideoUser() {
    this.callInProgress = true;
    this.isCallInitiator = true;
    this.callType = 'video';
    try {
      this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

      this.setupVideoElements();
      this.initializePeerConnection();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socketService.callUser(this.receiverId, offer, this.authService.getLoggedInUser()._id, 'video');
    } catch (error) {
      console.error('Error starting video call:', error);
      this.toastr.error(`Failed to start video call: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
      this.callInProgress = false;
      this.router.navigate(['/chat'])
    }
  }

  async callAudioUser() {
    this.callInProgress = true;
    this.isCallInitiator = true;

    try {
      this.callType = 'audio';
      this.myStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.setupAudioElements();
      this.initializePeerConnection();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socketService.callUser(this.receiverId, offer, this.authService.getLoggedInUser()._id, 'audio');
    } catch (error) {
      console.error('Error starting audio call:', error);
      this.toastr.error(`Failed to start audio call: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
      this.callInProgress = false;
    }
  }

  private listenForCalls() {
    this.socketService.onIncomingCall().subscribe(async (data: any) => {
      if (!data.offer) return;
      this.callType = data.callType;
      this.callInProgress = true;

      try {
        this.myStream = await navigator.mediaDevices.getUserMedia(
          data.callType === "video" ? { video: true, audio: true } : { audio: true, video: false }
        );

        if (data.callType === "video" && this.callType === 'video') {
          this.setupVideoElements();
        } else {
          this.setupAudioElements();
        }

        this.initializePeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.socketService.answerCall(data.from, answer);
      } catch (error) {
        console.error('Error answering call:', error);
        this.toastr.error(`Error answering call: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
        this.callInProgress = false;
      }
    });

    this.socketService.onCallAccepted().subscribe(async (data: any) => {
      try {
        if (data.answer && this.peerConnection) {
          await this.peerConnection.setRemoteDescription(data.answer);
        }
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    });

    this.socketService.onIceCandidate().subscribe((candidate: RTCIceCandidate) => {
      if (candidate && this.peerConnection) {
        this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });
  }

  private setupAudioElements() {
    if (this.myStream) {
      const audioElement = new Audio();
      audioElement.srcObject = this.myStream;
      audioElement.muted = true;
      audioElement.play();
    }
  }

  private setupVideoElements() {
    if (this.myVideo?.nativeElement) {
      this.myVideo.nativeElement.srcObject = this.myStream;
      this.myVideo.nativeElement.muted = true;
      this.myVideo.nativeElement.play();
    }
  }

  private initializePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => sender.track?.stop());
      this.peerConnection.close();
    }
    this.peerConnection = new RTCPeerConnection(this.servers);
    this.previousStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.previousStreams = [];

    this.myStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.myStream);
    });

    this.previousStreams.push(this.myStream);
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socketService.sendIceCandidate(this.receiverId, event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      if (event.track.kind === "video") {
        if (!this.userVideo?.nativeElement.srcObject) {
          this.userVideo.nativeElement.srcObject = new MediaStream();
        }
        const remoteStream = this.userVideo.nativeElement.srcObject as MediaStream;

        remoteStream.addTrack(event.track);
        this.remoteVideoActive = true;
        event.track.onended = () => {
          this.remoteVideoActive = false;
        };
      }

      if (event.track.kind === "audio") {
        const audioElement = this.userVideo?.nativeElement || new Audio();
        if (!audioElement.srcObject) {
          audioElement.srcObject = new MediaStream();
        }
        (audioElement.srcObject as MediaStream).addTrack(event.track);
        audioElement.play();
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;

      console.log('Connection state:', this.peerConnection.connectionState);

      switch (this.peerConnection.connectionState) {
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.toastr.warning('Connection lost', '', { timeOut: 2000 });
          this.endCall();
          break;
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;

      console.log('ICE connection state:', this.peerConnection.iceConnectionState);

      if (this.peerConnection.iceConnectionState === 'disconnected' || this.peerConnection.iceConnectionState === 'failed') {
        this.toastr.warning('Network connection lost', '', { timeOut: 2000 });
        this.endCall();
      }
    };
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.myStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
  }

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.myStream.getVideoTracks().forEach(track => { track.enabled = this.isVideoEnabled });
    this.localVideoActive = this.isVideoEnabled;
  }

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopScreenRecording();
    } else {
      this.startScreenRecording();
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      const videoSender = this.peerConnection.getSenders().find(
        s => s.track?.kind === 'video'
      );

      if (videoSender) {
        const screenTrack = this.screenStream!.getVideoTracks()[0];
        await videoSender.replaceTrack(screenTrack);

        if (this.myVideo?.nativeElement) {
          this.myVideo.nativeElement.srcObject = this.screenStream;
        }

        this.isScreenSharing = true;

        screenTrack.onended = () => {
          this.stopScreenShare();
        };
      }
    } catch (error) {
      console.error('Error starting screen share:', error);
      this.toastr.error(`Failed to start screen sharing: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
    }
  }

  async stopScreenShare() {
    if (!this.isScreenSharing) return;

    try {
      this.screenStream?.getTracks().forEach(track => track.stop());

      const videoSender = this.peerConnection.getSenders().find(
        s => s.track?.kind === 'video'
      );

      if (videoSender && this.myStream) {
        const cameraTrack = this.myStream.getVideoTracks()[0];
        if (cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }

        if (this.myVideo?.nativeElement) {
          this.myVideo.nativeElement.srcObject = this.myStream;
        }
      }

      this.isScreenSharing = false;
      this.screenStream = null;
    } catch (error) {
      console.error('Error stopping screen share:', error);
      this.toastr.error(`Error stopping screen share: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
    }
  }

  endCall() {

    if (this.callInProgress && this.receiverId) {
      this.socketService.endCall(this.receiverId);
    }
    if (this.callTimer) {
      clearInterval(this.callTimer);
    }
    console.log(`Call duration: ${this.callDuration} seconds`);

    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(error => console.log("Error releasing media devices:", error));
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => track.stop());
      this.myStream = null!;
    }
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) sender.track.stop();
      });
      this.peerConnection.close();
      this.peerConnection = null!;
    }

    if (this.myVideo?.nativeElement) {
      this.myVideo.nativeElement.srcObject = null;
    }
    if (this.userVideo?.nativeElement) {
      this.userVideo.nativeElement.srcObject = null;
    }
    if (this.isRecording) {
      this.stopScreenRecording();
    }
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        stream.getTracks().forEach(track => track.stop());
      })
      .catch(error => console.log("Error releasing media devices:", error));
    this.callInProgress = false;
    this.router.navigate(['/chat']);
  }

  // async startScreenRecording() {
  //   try {
  //     const combinedStream = new MediaStream();

  //     if (this.userVideo?.nativeElement?.srcObject) {
  //       const remoteStream = this.userVideo.nativeElement.srcObject as MediaStream;
  //       remoteStream.getTracks().forEach(track => {
  //         combinedStream.addTrack(track.clone());
  //       });
  //     }

  //     this.myStream.getAudioTracks().forEach(track => {
  //       combinedStream.addTrack(track.clone());
  //     });

  //     if (this.isScreenSharing && this.screenStream) {
  //       this.screenStream.getVideoTracks().forEach(track => {
  //         combinedStream.addTrack(track.clone());
  //       });

  //     } else {
  //       this.myStream.getVideoTracks().forEach(track => {
  //         combinedStream.addTrack(track.clone());
  //       });
  //     }

  //     this.mediaRecorder = new MediaRecorder(combinedStream, {
  //       mimeType: 'video/webm',
  //       bitsPerSecond: 2500000
  //     });

  //     this.recordedChunks = [];
  //     this.mediaRecorder.ondataavailable = (event) => {
  //       if (event.data.size > 0) {
  //         this.recordedChunks.push(event.data);
  //       }
  //     };

  //     this.mediaRecorder.onstop = () => {
  //       const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
  //       this.recordedVideoUrl = URL.createObjectURL(blob);
  //       this.downloadRecording();
  //     };

  //     this.mediaRecorder.start(1000);
  //     this.isRecording = true;
  //     this.toastr.info('Recording started');
  //   } catch (error) {
  //     console.error('Recording failed:', error);
  //     this.toastr.error('Recording could not be started');
  //   }
  // }

  async startScreenRecording() {
    try {
      const combinedStream = new MediaStream();

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      screenStream.getTracks().forEach(track => {
        combinedStream.addTrack(track.clone());
      });

      if (this.myStream) {
        this.myStream.getAudioTracks().forEach(track => {
          combinedStream.addTrack(track.clone());
        });
      }

      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm',
        bitsPerSecond: 2500000
      });

      this.recordedChunks = [];
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
        this.recordedVideoUrl = URL.createObjectURL(blob);
        this.downloadRecording();
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.toastr.info('Screen recording started');

    } catch (error) {
      console.error('Screen recording failed:', error);
      this.toastr.error(`Screen recording could not be started: ${error.message || 'Unknown error'}`, ``, { timeOut: 2000 });
    }
  }

  private downloadRecording() {
    if (!this.recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = this.recordedVideoUrl;
    a.download = `call-recording-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(this.recordedVideoUrl);
    this.recordedVideoUrl = null;
  }

  stopScreenRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.toastr.success('Recording saved');
    }
  }

}
