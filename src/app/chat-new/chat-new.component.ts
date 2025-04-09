import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { UserService } from '../core/services/user.service';
import { SocketService } from '../core/services/socket.service';
import { AuthService } from '../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-new',
  templateUrl: './chat-new.component.html',
  styleUrls: ['./chat-new.component.scss']
})
export class ChatNewComponent implements OnInit, AfterViewInit {
  chatData!: any[];
  groupChatData!: any[];
  username: string = this.authService.getLoggedInUser().username;
  groupname!: string;
  formData!: FormGroup;
  userProfile: string = '';
  loginUserProfile: string = this.authService.getLoggedInUser().avatar;
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
  groupForm!: FormGroup;
  showGroupForm = false;
  selectedMembers: any[] = [];
  selectedFile: File | null = null;
  isMobileView = false;
  isSidebarOpen = false;
  groupCallParticipants: any[] = [];
  activeGroupCalls: { [groupId: string]: boolean } = {};
  showDropdown = false;
  private callListenerSub: Subscription | undefined;




  @ViewChild('chatWindow', { static: false }) chatWindow!: ElementRef;
  @ViewChild("myVideo") myVideo!: ElementRef;
  @ViewChild("userVideo") userVideo!: ElementRef;

  receiverId!: string;
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
  callInProgress = false;
  isMuted: boolean = false;
  private previousStreams: MediaStream[] = [];
  isVideoEnabled: boolean = true;


  private recorder!: MediaRecorder;
  private recordedChunks: Blob[] = [];
  recordedVideoUrl: string | null = null;

  private combinedStream!: MediaStream;
  isScreenSharing = false;
  private screenStream: MediaStream | null = null;


  constructor(
    public formBuilder: FormBuilder,
    private userService: UserService,
    private socketService: SocketService,
    public authService: AuthService,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private fb: FormBuilder,

  ) {
    this.groupForm = this.fb.group({
      groupName: ['', Validators.required],
      groupDescription: [''],
      groupMembers: [[]],
      groupAvatar: null,
    });

    this.formData = this.formBuilder.group({
      message: ['', Validators.required]
    });

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
    this.checkScreenSize();
    this.setupCallNotifications();
    this.loadChatConversations();
    this.loadGroupConversations();
    this.loadUsers();
    // this.listenForCalls();
    this.socketService.newMessageReceived().subscribe(message => {
      this.handleNewMessage(message);
    });
    this.socketService.messagesMarkedRead().subscribe(data => {
      this.handleMessagesMarkedRead(data);
    });
    document.addEventListener('paste', (event: ClipboardEvent) => this.handleClipboardFiles(event));
    window.addEventListener('resize', this.checkScreenSize.bind(this));

    this.socketService.onGroupCallStarted().subscribe((data: any) => {
      if (data.groupId === this.conversationId) {
        this.activeGroupCalls[data.groupId] = data.activeGroupCall;

        this.groupCallParticipants = data.participants || [];
        this.cdr.detectChanges();
      }
    });

    this.socketService.onGroupCallParticipantJoined().subscribe((data: any) => {
      if (data.groupId === this.conversationId) {
        this.groupCallParticipants.push(data.userId);
      }
    });

    this.socketService.onGroupCallParticipantLeft().subscribe((data: any) => {
      if (data.groupId === this.conversationId) {
        this.groupCallParticipants = this.groupCallParticipants.filter(
          id => id !== data.userId
        );
      }
    });
  }

  checkScreenSize() {
    this.isMobileView = window.innerWidth <= 768;
    if (!this.isMobileView) {
      this.isSidebarOpen = true;
    }
  }

  ngOnDestroy() {
    this.endCall();
    window.removeEventListener('beforeunload', this.endCall.bind(this));
    this.callListenerSub?.unsubscribe();
  }

  ngAfterViewInit() {
    if (this.chatWindow)
      this.scrollToBottom();
  }


  private setupCallNotifications() {
    this.callListenerSub = this.socketService.onIncomingCall().subscribe(async (data: any) => {
      const myUserId = this.authService.getLoggedInUser()._id;

      if (!data.offer) return;
      if (data.from === myUserId) return;
      if (this.callInProgress) {
        console.log("Already in a call. Ignoring incoming call.");
        return;
      }
      if (data.to !== myUserId) {
        console.log("This call is not for me.");
        return;
      }
      this.userService.getUserById(data.from).subscribe({
        next: (res) => {
          const callerName = res.data.username || 'Unknown User';

          const accept = confirm(`${callerName} is calling you. Would you like to accept this ${data.callType} call?`);
    
          if (accept) {
            this.callInProgress = true;

            this.callListenerSub?.unsubscribe();

            this.router.navigate(['/video-call', data.from], {
              queryParams: { callType: data.callType }
            });
          } else {
            console.log('Call not accepted');
          }
        },
        error: (err) => {
          console.error("Failed to fetch caller info:", err);
        }
      });
    });
  }


  startVideoCall(receiverId: string) {
    this.router.navigate(['/video-call', receiverId], {
      queryParams: { initiator: 'true', callType: 'video' }
    });
  }

  startAudioCall(receiverId: string) {
    this.router.navigate(['/video-call', receiverId], {
      queryParams: { initiator: 'true', callType: 'audio' }
    });
  }

  startGroupAudioCall(groupId: string) {
    this.router.navigate(['/group-call', groupId], {
      queryParams: { initiator: 'true', callType: 'audio' }
    });
  }

  startGroupVideoCall(groupId: string) {
    this.router.navigate(['/group-call', groupId], {
      queryParams: { initiator: 'true', callType: 'video' }
    });
  }

  joinGroupCall(groupId: string) {
    if (this.activeGroupCalls[groupId]) {
      this.router.navigate(['/group-call', groupId]);
    }
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

  onLogoutClick() {
    this.socketService.disconnectSocket();
    this.authService.logout();
    this.toastr.success('Logout Successfully', '', { timeOut: 2000 });

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

  chatUsername(name: string, avatar: any, status: boolean, conversationId: string, receiverId: string) {

    this.isGroupChat = false;
    this.receiverId = receiverId;

    this.username = name;
    this.userProfile = avatar;
    this.isStatus = status;

    if (!conversationId) {
      this.startNewChat(receiverId, name, avatar);

    } else {
      this.conversationId = conversationId;
      this.loadMessages(this.conversationId);
      this.socketService.markMessagesAsRead(conversationId);
    }
    this.isSidebarOpen = !this.isSidebarOpen;

  }
  startNewChat(userId: string, username: string, avatar: string) {
    this.userService.createOrGetConversation(userId).subscribe({
      next: response => {
        if (response && response.conversationId) {
          this.conversationId = response.conversationId;
          this.socketService.joinConversation(response.conversationId);
          this.username = username;
          this.userProfile = avatar;

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
    this.groupAvatar = group.groupAvatar ? group.groupAvatar : 'assets/default-avatar.jpg';;
    this.conversationId = group._id;
    this.groupMembers = group.members;
    this.loadMessages(this.conversationId);
    this.socketService.markMessagesAsRead(this.conversationId);
    this.isSidebarOpen = !this.isSidebarOpen;

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

  handleClipboardFiles(event: ClipboardEvent) {
    const clipboardItems: any = event.clipboardData?.items;
    for (let i = 0; i < clipboardItems?.length!; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          this.file = file;
          this.fileName = URL.createObjectURL(file);
          this.toastr.info('File copied from clipboard!');
        }
      }
    }
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

  toggleGroupForm() {
    this.showGroupForm = !this.showGroupForm;
    if (this.showGroupForm) {
      this.loadUsers();
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length) {
      this.selectedFile = target.files[0];
    }
  }
  
  toggleDropdown() {
    this.showDropdown = !this.showDropdown;
  }
  selectUser(user: any) {
    if (!this.selectedMembers.find(u => u._id === user._id)) {
      this.selectedMembers.push(user);
      this.groupForm.get('groupMembers')?.setValue(this.selectedMembers.map(u => u._id));
    }
  }
  
  removeUser(user: any) {
    this.selectedMembers = this.selectedMembers.filter(u => u._id !== user._id);
    this.groupForm.get('groupMembers')?.setValue(this.selectedMembers.map(u => u._id));
  }
  
  isSelected(user: any): boolean {
    return !!this.selectedMembers.find(u => u._id === user._id);
  }

  createGroup() {
    if (this.groupForm.invalid || this.selectedMembers.length < 2) {
      this.toastr.error('Please provide a valid group name, description, and select at least 2 members.');
      return;
    }

    const groupData = {
      groupName: this.groupForm.get('groupName')?.value,
      groupAdmin: this.authService.getLoggedInUser()._id,
      members: this.groupForm.get('groupMembers')?.value,
      groupDescription: this.groupForm.get('groupDescription')?.value || ''
    };

    const formData = new FormData();

    formData.append('groupName', groupData.groupName);
    formData.append('groupAdmin', groupData.groupAdmin);
    formData.append('groupMembers', JSON.stringify(groupData.members));
    formData.append('groupDescription', groupData.groupDescription);

    if (this.selectedFile) {
      formData.append('image', this.selectedFile);
    }

    this.userService.createGroup(formData).subscribe({
      next: (response) => {
        this.toastr.success('Group created successfully!', '', { timeOut: 2000 });
        this.loadGroupConversations();
        this.showGroupForm = false;
        this.groupForm.reset();
        this.selectedMembers = [];
      },
      error: () => {
        this.toastr.error('Failed to create group.', '', { timeOut: 2000 });
      }
    });
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
  onCopyMessage(msg: any) {
    if (msg.type === 'image') {
      fetch(msg.fileUrl)
        .then((res) => res.blob())
        .then((blob) => {
          if (blob.type === 'image/jpeg') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();

            img.onload = () => {
              canvas.width = img.width;
              canvas.height = img.height;
              ctx?.drawImage(img, 0, 0);

              canvas.toBlob((pngBlob) => {
                if (pngBlob) {
                  const item = new ClipboardItem({ 'image/png': pngBlob });
                  navigator.clipboard.write([item]).then(() => {
                    this.toastr.info('Image copied to clipboard!', '', { timeOut: 500 });
                  }).catch((err) => {
                    console.error('Failed to copy image to clipboard: ', err);
                  });
                }
              }, 'image/png');
            };

            img.src = URL.createObjectURL(blob);
          } else {
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item]).then(() => {
              this.toastr.info('Image copied to clipboard!', '', { timeOut: 500 });
            }).catch((err) => {
              console.error('Failed to copy image to clipboard: ', err);
            });
          }
        })
        .catch((err) => {
          console.error('Error fetching the image: ', err);
        });
    } else {
      const messageContent = msg.content;
      navigator.clipboard.writeText(messageContent).then(() => {
        this.toastr.info('Message copied!', '', { timeOut: 500 });
      }).catch((err) => {
        console.error('Failed to copy message: ', err);
      });
    }
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

      // this.startRecording(this.myStream, 'myVideo');
      this.startRecording();

      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      this.socketService.callUser(this.receiverId, offer, this.authService.getLoggedInUser()._id, 'video');
    } catch (error) {
      console.error('Error starting video call:', error);
      this.toastr.error('Failed to start video call');
      this.callInProgress = false;
    }
  }

  private startRecording() {
    const recorder = new MediaRecorder(this.combinedStream);
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      this.recordedVideoUrl = url;
      this.recordedChunks = chunks;
    };

    recorder.start();
    this.recorder = recorder;
  }

  stopRecording() {
    if (this.recorder) {
      this.recorder.stop();
    }
  }

  async toggleScreenShare() {
    if (this.isScreenSharing) {
      await this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const videoSender = this.peerConnection.getSenders().find(
        s => s.track?.kind === 'video'
      );

      if (videoSender) {
        const screenTrack = this.screenStream.getVideoTracks()[0];
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
      this.toastr.error('Failed to start screen sharing');
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
    if (this.isScreenSharing) {
      this.stopScreenShare();
    }
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

  navigateToChat() {
    this.router.navigate(['/test']);
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
    console.log(this.isSidebarOpen);

  }

}


