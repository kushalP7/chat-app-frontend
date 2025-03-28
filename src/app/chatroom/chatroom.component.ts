import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnInit, Output, Renderer2, SimpleChanges, ViewChild } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { UserService } from '../core/services/user.service';
import { ToastrService } from 'ngx-toastr';


@Component({
  selector: 'app-chatroom',
  templateUrl: './chatroom.component.html',
  styleUrls: ['./chatroom.component.scss']
})
export class ChatroomComponent implements OnInit, AfterViewInit {

  @Input() conversationId!: string;
  @Input() receiverId!: string;
  @Input() receiverName!: string;
  @ViewChild('chatWindow') private chatWindow!: ElementRef;
  @Output() messageSent = new EventEmitter<{ conversationId: string, content: string, createdAt: string }>();
  
  @Input() groupId  !: string;
  @Input() groupName!: string;
  @Input() groupMembers!: any[];
  @Input() activeSection!: string;

  receiverAvatar!: string;
  message: string = '';
  fileName: string = '';
  messageArray: Array<{ userId: string, content?: string, fileUrl?: string, type: string, createdAt: string }> = [];
  isTyping: boolean = false;
  isOnline: boolean = false;
  lastSeen: string | null = null;
  file: File | null = null;

  previewUrl: string | null = null;
  previewType: string | null = null;
  callType: 'audio' | 'video' = 'video';


  @ViewChild("myVideo") myVideo!: ElementRef;
  @ViewChild("userVideo") userVideo!: ElementRef;

  private myStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };
  callInProgress = false;
  isMuted: boolean = false;
  isVideoEnabled: boolean = true;
  private previousStreams: MediaStream[] = [];

  constructor(
    private socketService: SocketService,
    public authService: AuthService,
    public userService: UserService,
    private toastr: ToastrService,

  ) {
    this.socketService.newMessageReceived().subscribe(data => {
      if (data.conversationId !== this.conversationId) return;

      if (!this.messageArray.some(msg => msg.createdAt === data.createdAt)) {
        this.messageArray.push(data);
      }
      this.isTyping = false;
      this.messageSent.emit({ conversationId: this.conversationId, content: this.message, createdAt: data.createdAt });

      setTimeout(() => this.scrollToBottom(), 100);

    });

    this.socketService.receivedTyping().subscribe(data => {
      if (data.userId !== this.authService.getLoggedInUser()._id) {
        this.isTyping = data.isTyping;
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.chatWindow) {
      this.scrollToBottom();
    }
  }

  ngOnInit(): void {
    this.loadMessages();
    this.listenForCalls();

    this.debugPeerConnectionStats();

  }

  ngOnDestroy() {
    this.endCall();
    window.removeEventListener('beforeunload', this.endCall.bind(this));
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversationId'] && !changes['conversationId'].firstChange) {
      this.loadMessages();
    }

    this.userService.getUserById(this.receiverId).subscribe({
      next: (response) => {
        this.receiverName = response.data.username;
        this.receiverAvatar = response.data.avatar;
        this.isOnline = response.data.isOnline;
        this.lastSeen = response.data.lastSeen;
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  private loadMessages(): void {
    this.socketService.joinConversation(this.conversationId);
    this.userService.getMessages(this.conversationId).subscribe(response => {
      if (response.success) {
        this.messageArray = response.data;

        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  sendMessage() {
    const userId = this.authService.getLoggedInUser()._id;
    if (this.file) {
      this.socketService.uploadFile(this.file).subscribe(response => {
        const messageData = {
          user: userId,
          conversationId: this.conversationId,
          content: this.message,
          fileUrl: response.fileUrl,
          type: this.file?.type.startsWith("image") ? "image" : this.file?.type.startsWith("video") ? "video" : "audio",
          createdAt: new Date().toISOString()
        };

        this.socketService.sendMessage(messageData);

        this.file = null;
        this.fileName = "";
        this.message = "";
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } else {
      const messageData = {
        user: userId,
        conversationId: this.conversationId,
        content: this.message,
        type: "text",
        createdAt: new Date().toISOString()
      };

      this.socketService.sendMessage(messageData);

      this.message = "";
      setTimeout(() => this.scrollToBottom(), 100);
    }

  }

  handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.file = input.files[0];
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.fileName = reader.result as string;
    };
    reader.readAsDataURL(this.file!);
  }

  typing(): void {
    const userId = this.authService.getLoggedInUser()._id;
    this.socketService.typing(this.conversationId, userId);
  }

  private scrollToBottom(): void {
    try {
      setTimeout(() => {
        this.chatWindow.nativeElement.scrollTop = this.chatWindow.nativeElement.scrollHeight;
      }, 50);
    } catch (error: any) {
      this.toastr.error(error.message, '', { timeOut: 2000 });
    }
  }

  removeSelectedImage() {
    this.fileName = "";
  }

  // private listenForCalls() {
  //   this.socketService.onIncomingCall().subscribe(async (data: any) => {
  //     if (!data.offer) return;

  //     if (confirm(`${data.from} is calling. Accept?`)) {
  //       this.callInProgress = true;

  //       try {
  //         this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  //         this.setupVideoElements();
  //         this.initializePeerConnection();

  //         await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
  //         const answer = await this.peerConnection.createAnswer();
  //         await this.peerConnection.setLocalDescription(answer);

  //         this.socketService.answerCall(data.from, answer);
  //       } catch (error) {
  //         console.error('Error answering call:', error);
  //         this.callInProgress = false;
  //       }
  //     }
  //   });

  //   this.socketService.onCallAccepted().subscribe(async (data: any) => {
  //     try {
  //       if (data.answer) {
  //         await this.peerConnection.setRemoteDescription(data.answer);
  //         const remoteStream = this.userVideo.nativeElement.srcObject;
  //         if (remoteStream.getAudioTracks().length === 0) {
  //           this.toastr.warning('Remote audio not detected');
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Answer handling error:', error);
  //     }
  //   });


  //   this.socketService.onIceCandidate().subscribe((candidate: RTCIceCandidate) => {
  //     if (candidate && this.peerConnection) {
  //       this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  //     }
  //   });
  // }

  private listenForCalls() {
    this.socketService.onIncomingCall().subscribe(async (data: any) => {
      if (!data.offer) return;
      this.callType = data.callType;
      const callType = data.callType === "video" ? "Video Call" : "Audio Call";
      console.log('data', data);

      if (confirm(`${data.from} is calling. Accept ${callType}?`)) {
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
          this.callInProgress = false;
        }
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

  // async callUser() {
  //   this.callInProgress = true;

  //   try {
  //     this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  //     console.log('Audio tracks:', this.myStream.getAudioTracks());
  //     this.setupVideoElements();
  //     this.initializePeerConnection();

  //     const offer = await this.peerConnection.createOffer();
  //     await this.peerConnection.setLocalDescription(offer);

  //     this.socketService.callUser(this.receiverId, offer, this.authService.getLoggedInUser()._id);
  //   } catch (error) {
  //     console.error('Error starting call:', error);
  //     this.toastr.error('Failed to start call');
  //     this.callInProgress = false;
  //   }
  // }

  async callAudioUser() {
    this.callInProgress = true;

    try {
      this.callType = 'audio';
      this.myStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      this.setupAudioElements();
      this.initializePeerConnection();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socketService.callUser(this.receiverId, offer, this.authService.getLoggedInUser()._id, 'audio');
    } catch (error) {
      console.error('Error starting audio call:', error);
      this.toastr.error('Failed to start audio call');
      this.callInProgress = false;
    }
  }

  async callVideoUser() {
    this.callInProgress = true;
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
      this.toastr.error('Failed to start video call');
      this.callInProgress = false;
    }
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
      this.myVideo.nativeElement.muted = this.isMuted;
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

    // this.myStream.getTracks().forEach(track => {
    //   if (!this.peerConnection.getSenders().some(sender => sender.track === track)) {
    //     this.peerConnection.addTrack(track, this.myStream);
    //   }
    // });
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


  }

  private debugPeerConnectionStats() {
    setInterval(async () => {
      if (!this.peerConnection) return;

      const stats = await this.peerConnection.getStats();
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          console.log('Inbound RTP:', report);
        }
      });
    }, 5000);
  }

  endCall() {
    if (this.peerConnection) {
      this.peerConnection.getSenders().forEach(sender => {
        if (sender.track) {
          sender.track.stop();
        }
      });
      this.peerConnection.close();
      this.peerConnection = null!;
    }
    if (this.myStream) {
      this.myStream.getTracks().forEach(track => track.stop());
    }
    this.callInProgress = false;
  }


  openPreview(url: string, type: string) {
    this.previewUrl = url;
    this.previewType = type;
  }

  closePreview() {
    this.previewUrl = null;
    this.previewType = null;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.myStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted; // Only enable if not muted
    });

  }
  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.myStream.getVideoTracks().forEach(track => { track.enabled = this.isVideoEnabled });
  }



}