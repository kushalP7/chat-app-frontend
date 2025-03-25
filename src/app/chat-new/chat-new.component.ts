import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { UserService } from '../core/services/user.service';
import { SocketService } from '../core/services/socket.service';
import { AuthService } from '../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-chat-new',
  templateUrl: './chat-new.component.html',
  styleUrls: ['./chat-new.component.scss']
})
export class ChatNewComponent implements OnInit, AfterViewInit {
  chatData!: any[];
  groupChatData!: any[];
  username: string = 'KP';
  groupname!: string;
  formData!: FormGroup;
  userProfile: string = '';
  groupAvatar: string = '';
  isStatus: boolean = false;
  activeSection: 'chat' | 'groups' | 'contacts' = 'chat';
  messageArray: Array<{ userId: any, content?: string, fileUrl?: string, type: string, createdAt: string, senderName?: string }> = [];
  groupMembers!: any[];
  isGroupChat = false;
  previewUrl: string | null = null;
  previewType: string | null = null;
  fileName: string = '';
  file: File | null = null;
  message: string = '';
  conversationId!: string;
  isTyping: boolean = false;
  users: any[] = [];
  apiUrl = environment.apiUrl + '/';

  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild("myVideo") myVideo!: ElementRef;
  @ViewChild("userVideo") userVideo!: ElementRef;

  receiverId!: string;
  callType: 'audio' | 'video' = 'video';
  private myStream!: MediaStream;
  private peerConnection!: RTCPeerConnection;
  private servers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };
  callInProgress = false;
  isMuted: boolean = false;
  private previousStreams: MediaStream[] = [];
  isVideoEnabled: boolean = true;
  isUserVideoEnabled: boolean = true;
  showEmojiPicker = false;


  constructor(
    public formBuilder: FormBuilder,
    private userService: UserService,
    private socketService: SocketService,
    public authService: AuthService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {

    this.socketService.newMessageReceived().subscribe(data => {
      if (data.conversationId !== this.conversationId) return;

      if (!this.messageArray.some(msg => msg.createdAt === data.createdAt)) {
        this.messageArray.push(data);
      }
      this.isTyping = false;
      setTimeout(() => this.scrollToBottom(), 100);
    });

    this.socketService.newGroupMessageReceived().subscribe((data) => {
      if (data.conversationId !== this.conversationId) return;
      if (!this.messageArray.some(msg => msg.createdAt === data.createdAt)) {
        this.userService.getUserById(data.userId).subscribe({
          next: (response) => {
            data.senderName = response.data.username;
            this.messageArray.push(data);
            this.isTyping = false;
            setTimeout(() => this.scrollToBottom(), 100);
          },
          error: (error) => {
            console.log("Error fetching user:", error);
          }
        });
      }
    });
  }

  ngOnInit(): void {
    console.log('receiverId', this.receiverId);

    this.formData = this.formBuilder.group({
      message: ['', Validators.required]
    });

    this.loadChatConversations();
    this.loadGroupConversations();
    this.loadUsers();
    this.listenForCalls();
    this.socketService.newMessageReceived().subscribe(message => {
      this.handleNewMessage(message);
    });
    this.socketService.messagesMarkedRead().subscribe(data => {
      this.handleMessagesMarkedRead(data);
    });
    this.debugPeerConnectionStats();


  }

  ngOnDestroy() {
    this.endCall();
    window.removeEventListener('beforeunload', this.endCall.bind(this));
  }


  loadUsers() {
    this.userService.getAllUsersExceptCurrentUser().subscribe({
      next: (response) => {
        this.users = response.data;
      },
      error: (error) => {
        this.toastr.error('Failed to load users', '', { timeOut: 2000 });
      }
    });
  }

  ngAfterViewInit() {
    if (this.chatWindow) {
      this.scrollToBottom();
    } else {
      console.error('chatWindow is not initialized');
    }
  }


  loadChatConversations() {
    this.userService.getUserConversations().subscribe({
      next: (response) => {
        this.chatData = response.data;
      },
      error: (error) => {
        this.toastr.error('Failed to load group conversations', '', { timeOut: 2000 });
      }
    });

  }

  private loadGroupConversations() {
    this.userService.getUserGropuConversations().subscribe({
      next: (response) => {
        this.groupChatData = response.data;
      },
      error: (error) => {
        this.toastr.error('Failed to load group conversations', '', { timeOut: 2000 });
      }
    });
  }
  chatUsername(name: string, avatar: any, status: boolean, conversationId: string, username: string, receiverId: string) {
    this.isGroupChat = false;
    this.receiverId = receiverId;
    this.username = name;
    this.userProfile = avatar ? 'http://192.168.4.29:8080/' + avatar : 'assets/default-avatar.jpg';
    this.isStatus = status;

    if (!conversationId) {
      this.startNewChat(receiverId, name, avatar);

    } else {
      this.conversationId = conversationId;
      this.loadMessages(this.conversationId);
      this.socketService.markMessagesAsRead(conversationId);
    }

  }
  startNewChat(userId: string, username: string, avatar: string) {
    this.userService.createOrGetConversation(userId).subscribe({
      next: response => {
        if (response && response.conversationId) {
          this.conversationId = response.conversationId;
          this.socketService.joinConversation(response.conversationId);
          this.username = username;
          this.userProfile = avatar ? 'http://192.168.4.29:8080/' + avatar : 'assets/default-avatar.jpg';

          this.loadMessages(this.conversationId);
          this.cdr.detectChanges();

        } else {
          this.toastr.error('Failed to create or retrieve conversation', '', { timeOut: 2000 });
        }
      },
    });
  }

  openGroupChat(group: any) {
    this.isGroupChat = true;
    this.groupname = group.groupName;
    this.groupAvatar = group.groupAvatar ? 'http://192.168.4.29:8080/' + group.groupAvatar : 'assets/default-avatar.jpg';;
    this.conversationId = group._id;
    this.groupMembers = group.members;
    this.loadMessages(this.conversationId);
    this.socketService.markMessagesAsRead(this.conversationId);

  }

  typing(): void {
    const userId = this.authService.getLoggedInUser()._id;
    this.socketService.typing(this.conversationId, userId);
  }

  sendMessage() {
    this.message = this.formData.get('message')!.value;
    const loggedInUser = this.authService.getLoggedInUser();

    const messageData: any = {
      userId: {
        _id: loggedInUser._id,
        username: loggedInUser.username,
        email: loggedInUser.email,
        avatar: loggedInUser.avatar,
        isOnline: loggedInUser.isOnline,
        lastSeen: loggedInUser.lastSeen
      },
      conversationId: this.conversationId,
      content: this.message,
      createdAt: new Date().toISOString(),
    };

    console.log('messageData', messageData);
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
          messageData.conversationId = this.conversationId;
          this.socketService.sendGroupMessage(messageData);
        } else {
          this.socketService.sendMessage(messageData);
        }
        this.file = null;
        this.fileName = "";
        this.formData.reset();
        setTimeout(() => this.scrollToBottom(), 100);
      });
    } else {
      messageData.type = "text";
      if (this.isGroupChat) {
        messageData.conversationId = this.conversationId;
        this.socketService.sendGroupMessage(messageData);
      } else {
        this.socketService.sendMessage(messageData);
      }
      setTimeout(() => this.scrollToBottom(), 100);
      this.formData.reset();
    }


  }

  removeSelectedImage() {
    this.fileName = "";
  }

  handleFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.file = input.files[0];
    }
    const reader = new FileReader();
    reader.onload = () => { this.fileName = reader.result as string; };
    reader.readAsDataURL(this.file!);
  }


  private loadMessages(conversationId: string): void {
    if (this.isGroupChat) {
      this.socketService.joinGroup(conversationId);
      this.userService.getMessages(conversationId).subscribe(response => {
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
      this.socketService.joinConversation(conversationId);
      this.userService.getMessages(conversationId).subscribe(response => {
        if (response.success) {
          this.messageArray = response.data;
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });
    }
  }

  formatTimestamp(dateString: string): string {
    if (!dateString) return '';

    const now = new Date();
    const messageDate = new Date(dateString);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    } else if (diffHours < 24) {
      return `${diffHours} Hr${diffHours > 1 ? 's' : ''}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return messageDate.toLocaleDateString();
    }
  }

  openPreview(url: string, type: string) {
    this.previewUrl = url;
    this.previewType = type;
  }

  closePreview() {
    this.previewUrl = null;
    this.previewType = null;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.chatWindow?.nativeElement) {
        const scrollElement = this.chatWindow.nativeElement.closest('ngx-simplebar')?.querySelector('.simplebar-content-wrapper');

        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        } else {
          console.error('Scrollable element not found inside ngx-simplebar');
        }
      }
    }, 50);
  }

  handleNewMessage(message: any) {
    const updateConversations = (conversations: any[]) => {
      const conversation = conversations.find(c => c._id === message.conversationId);
      if (conversation) {
        conversation.lastMessage = {
          content: message.content,
          createdAt: message.createdAt
        };

        if (this.conversationId !== message.conversationId &&
          message.userId !== this.authService.getLoggedInUser()._id) {
          conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        }
      }
      return conversations;
    };

    this.chatData = updateConversations(this.chatData);
    this.groupChatData = updateConversations(this.groupChatData);
    this.cdr.detectChanges();

  }


  handleMessagesMarkedRead(data: { conversationId: string, userId: string }) {
    const updateUnreadCount = (conversations: any[]) => {
      const conversation = conversations.find(c => c._id === data.conversationId);
      if (conversation) {
        conversation.unreadCount = 0;
      }
    };

    updateUnreadCount(this.chatData);
    updateUnreadCount(this.groupChatData);

    this.cdr.detectChanges();
  }


  async callAudioUser() {
    this.callInProgress = true;

    try {
      this.callType = 'audio';
      this.myStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        },
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
      this.myStream = await navigator.mediaDevices.getUserMedia({
        video: true, audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

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
      audioElement.muted = this.isMuted;
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
            data.myStreamcallType === "video" ? { video: true, audio: true } : { audio: true, video: false }
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

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.myStream.getVideoTracks().forEach(track => { track.enabled = this.isVideoEnabled });
  }
  // async toggleVideo() {
  //   this.isVideoEnabled = !this.isVideoEnabled;

  //   if (this.isVideoEnabled) {
  //     try {
  //       this.myStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  //       this.myStream.getVideoTracks().forEach(track => {
  //         track.enabled = true;
  //       });

  //       if (this.myVideo?.nativeElement) {
  //         this.myVideo.nativeElement.srcObject = this.myStream;
  //       }

  //       this.myStream.getTracks().forEach(track => {
  //         this.peerConnection.addTrack(track, this.myStream);
  //       });
  //     } catch (error) {
  //       console.error('Error re-acquiring video stream:', error);
  //       this.toastr.error('Failed to turn video back on');
  //       this.isVideoEnabled = false;
  //     }
  //   } else {
  //     this.myStream.getVideoTracks().forEach(track => {
  //       track.enabled = false;
  //     });
  //   }
  // }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.myStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
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

  private debugPeerConnectionStats() {
    setInterval(async () => {
      if (!this.peerConnection) return;

      const stats = await this.peerConnection.getStats();
      stats.forEach(data => {
        if (data.type === 'inbound-rtp') {
          console.log('inbound-rtp:', data);
        }
      });
    }, 5000);
  }

  navigateToChat() {
    this.router.navigate(['/test']);
  }

}


