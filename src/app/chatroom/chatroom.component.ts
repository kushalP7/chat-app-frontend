
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, Renderer2, SimpleChanges, ViewChild } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { UserService } from '../core/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';




@Component({
  selector: 'app-chatroom',
  templateUrl: './chatroom.component.html',
  styleUrls: ['./chatroom.component.scss']
})
export class ChatroomComponent implements OnInit, AfterViewInit {

  @Input() conversationId!: string;
  @Input() groupId  !: string;
  @Input() groupName!: string;
  @Input() groupMembers!: any[];
  @Input() activeSection!: string;

  @Input() receiverId!: string;
  @Input() receiverName!: string;
  @ViewChild('chatWindow') private chatWindow!: ElementRef;
  @Output() messageSent = new EventEmitter<{ conversationId: string, content: string, createdAt: string }>();

  receiverAvatar!: string;
  groupAvatar!: string;
  message: string = '';
  fileName: string = '';
  messageArray: Array<{ userId: string, content?: string, fileUrl?: string, type: string, createdAt: string, senderName?: string }> = [];
  isTyping: boolean = false;
  isOnline: boolean = false;
  lastSeen: string | null = null;
  file: File | null = null;

  previewUrl: string | null = null;
  previewType: string | null = null;
  callType: 'audio' | 'video' = 'video';
  isGroupChat: boolean = false;

  @ViewChild("myVideo") myVideo!: ElementRef;
  @ViewChild("userVideo") userVideo!: ElementRef;

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
  callInProgress = false;
  isMuted: boolean = false;
  isVideoEnabled: boolean = true;
  private previousStreams: MediaStream[] = [];
  private pendingCandidates: RTCIceCandidate[] = [];

  constructor(
    private socketService: SocketService,
    public authService: AuthService,
    public userService: UserService,
    private toastr: ToastrService,
    private router: Router


  ) {
    this.socketService.newMessageReceived().subscribe(data => {
      if (data.conversationId !== this.conversationId) return;

      if (!this.messageArray.some(msg => msg.createdAt === data.createdAt)) {
        this.messageArray.push(data);
      }
      this.isTyping = false;
      this.messageSent.emit({ conversationId: this.conversationId, content: data.content, createdAt: data.createdAt });
      setTimeout(() => this.scrollToBottom(), 100);
    });

    this.socketService.newGroupMessageReceived().subscribe((data) => {
      if (data.conversationId !== this.groupId) return;
      if (!this.messageArray.some(msg => msg.createdAt === data.createdAt)) {
        this.userService.getUserById(data.userId).subscribe({
          next: (response) => {
            console.log('response', response);
            data.senderName = response.data.username;
            this.messageArray.push(data);
            this.isTyping = false;
            this.messageSent.emit({ conversationId: this.groupId, content: data.content, createdAt: data.createdAt });
            setTimeout(() => this.scrollToBottom(), 100);
          },
          error: (error) => {
            console.log("Error fetching user:", error);
          }
        });
      }

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

  ngOnInit() {
    this.isGroupChat = !!this.groupId;
    this.loadMessages();
    this.listenForCalls();

  }

  ngOnDestroy() {
    this.endCall();
    window.removeEventListener('beforeunload', this.endCall.bind(this));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['conversationId'] && !changes['conversationId'].firstChange) ||
      (changes['groupId'] && !changes['groupId'].firstChange)) {
      this.loadMessages();
    }

    this.isGroupChat = !!this.groupId;
    if (this.activeSection === 'groups') {
      this.userService.getGroupInfo(this.groupId).subscribe({
        next: (response) => {
          this.groupName = response.data.groupName
          this.groupMembers = response.data.membersDetails
          this.groupAvatar = response.data.groupAvatar
        },
        error: (error) => {
          console.log(error);
        }
      })
    }
    if (this.activeSection === 'oneToOne') {
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
  }


  private loadMessages(): void {
    if (this.isGroupChat) {
      this.socketService.joinGroup(this.conversationId);
      this.userService.getMessages(this.groupId).subscribe(response => {
        if (response.success) {
          this.messageArray = response.data.map((message: any) => {
            const sender = this.groupMembers.find(member => member._id === message.userId);
            if (sender) {
              message.senderName = sender.username;
            }
            return message;
          });
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });
    } else {
      this.socketService.joinConversation(this.conversationId);
      this.userService.getMessages(this.conversationId).subscribe(response => {
        if (response.success) {
          this.messageArray = response.data;
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });
    }
  }

  sendMessage() {
    const userId = this.authService.getLoggedInUser()._id;
    const messageData: any = {
      user: userId,
      conversationId: this.conversationId,
      content: this.message,
      createdAt: new Date().toISOString()
    };
    if (this.file) {
      this.socketService.uploadFile(this.file).subscribe(response => {
        messageData.fileUrl = response.fileUrl;
        if (this.file?.type.startsWith("image")) {
          messageData.type = "image";
        } else if (this.file?.type.startsWith("video")) {
          messageData.type = "video";
        } else if (this.file?.type.startsWith("audio")) {
          messageData.type = "audio";
        } else if (this.file?.type === "application/pdf") {
          messageData.type = "pdf";
        } else {
          messageData.type = "unknown";
        }
        if (this.isGroupChat) {
          messageData.conversationId = this.groupId;
          this.socketService.sendGroupMessage(messageData);
        } else {
          this.socketService.sendMessage(messageData);
        }
        this.file = null;
        this.fileName = "";
        this.message = "";
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } else {
      messageData.type = "text";
      if (this.isGroupChat) {
        messageData.conversationId = this.groupId;
        this.socketService.sendGroupMessage(messageData);
      } else {
        this.socketService.sendMessage(messageData);
      }
      setTimeout(() => this.scrollToBottom(), 100);
      this.message = "";
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
      this.toastr.error(error.error.message, '', { timeOut: 2000 });
    }
  }

  removeSelectedImage() {
    this.fileName = "";
  }

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

  endCall() {
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
      track.enabled = !this.isMuted;
    });

  }
  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.myStream.getVideoTracks().forEach(track => { track.enabled = this.isVideoEnabled });
  }

  async startGroupCall(callType: 'audio' | 'video') { }

  async joinCall() { }
}