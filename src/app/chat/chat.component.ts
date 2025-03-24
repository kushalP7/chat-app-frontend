import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UserService } from '../core/services/user.service';
import { SocketService } from '../core/services/socket.service';
import { AuthService } from '../core/services/auth.service';
import { ToastrService } from 'ngx-toastr';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit {
  oneToOneConversations: any[] = [];
  groupConversations: any[] = [];
  activeSection: 'oneToOne' | 'groups' = 'oneToOne';
  users: any[] = [];
  selectedConversationId: string | null = null;
  selectedReceiverId: string | null = null;
  selectedReceiverName: string | null = null;
  groupedUsers: { [key: string]: any[] } = {};
  selectedGroupName: string = '';
  selectedGroupMembers: any[] = [];

  groupForm!: FormGroup;
  showGroupForm = false;
  selectedMembers: string[] = [];
  selectedFile: File | null = null;

  constructor(
    private userService: UserService,
    private socketService: SocketService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private fb: FormBuilder,


  ) {
    this.groupForm = this.fb.group({
      groupName: ['', Validators.required],
      groupDescription: [''],
      groupAvatar: null,
    });

  }

  ngOnInit() {
    this.loadOneToOneConversations();
    this.loadGroupConversations();
    this.loadAllUsers();
    this.socketService.newMessageReceived().subscribe(message => {
      this.handleNewMessage(message);
    });
    this.socketService.messagesMarkedRead().subscribe(data => {
      this.handleMessagesMarkedRead(data);
    });
  }

  switchSection(section: 'oneToOne' | 'groups') {
    this.activeSection = section;
    this.selectedConversationId = '';
    this.selectedReceiverId = '';
    this.selectedReceiverName = '';
  }

  loadOneToOneConversations() {
    this.userService.getUserConversations().subscribe({
      next: (response) => {
        this.oneToOneConversations = response.data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastr.error('Failed to load group conversations', '', { timeOut: 2000 });
      }
    });
  }

  loadGroupConversations() {
    this.userService.getUserGropuConversations().subscribe({
      next: (response) => {
        this.groupConversations = response.data;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.toastr.error('Failed to load group conversations', '', { timeOut: 2000 });
      }
    });
  }

  handleNewMessage(message: any) {
    const updateConversations = (conversations: any[]) => {
      const conversation = conversations.find(c => c._id === message.conversationId);
      if (conversation) {
        conversation.lastMessage = {
          content: message.content,
          createdAt: message.createdAt
        };

        if (this.selectedConversationId !== message.conversationId &&
          message.userId !== this.authService.getLoggedInUser()._id) {
          conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        }
      }
      return conversations;
    };

    this.oneToOneConversations = updateConversations(this.oneToOneConversations);
    this.groupConversations = updateConversations(this.groupConversations);
    this.cdr.detectChanges();
  }

  handleMessagesMarkedRead(data: { conversationId: string, userId: string }) {
    const conversation = this.oneToOneConversations.find(c => c._id === data.conversationId);
    if (!conversation) return;

    conversation.unreadCount = 0;

    this.cdr.detectChanges();
  }

  openChat(conversationId: string, username: string, receiverId: string) {
    this.selectedConversationId = conversationId;
    this.selectedReceiverId = receiverId;
    this.selectedReceiverName = username;
    this.socketService.markMessagesAsRead(conversationId);
  }

  openGroupChat(conversation: any) {
    this.selectedConversationId = conversation._id;
    this.selectedReceiverName = conversation.groupName;
    this.socketService.markMessagesAsRead(conversation._id);
    this.socketService.joinConversation(conversation._id);
  }

  closeChat() {
    this.selectedConversationId = null;
    this.selectedReceiverId = null;
    this.selectedReceiverName = null;
  }

  closeGroupChat() {

  }

  openUserModal() {
    this.loadAllUsers();
  }


  startNewChat(userId: string, username: string) {
    this.userService.createOrGetConversation(userId).subscribe({
      next: response => {
        this.socketService.joinConversation(this.authService.getLoggedInUser()._id);
        this.selectedConversationId = response.conversationId;
        this.selectedReceiverId = userId;
        this.selectedReceiverName = username;
      },
      error: error => {
        this.toastr.error(error.message, '', { timeOut: 2000 });

      }
    });
  }

  updateLastMessage(event: { conversationId: string; content: string; createdAt: string }) {
    console.log(event);
    console.log('this.oneToOneConversations', this.oneToOneConversations);
  
    let updatedOneToOneConversations = this.oneToOneConversations.map(conversation =>
      conversation._id === event.conversationId
        ? { ...conversation, lastMessage: { content: event.content, createdAt: event.createdAt } }
        : conversation
    );
  
    let updatedGroupConversations = this.groupConversations.map(conversation =>
      conversation._id === event.conversationId
        ? { ...conversation, lastMessage: { content: event.content, createdAt: event.createdAt } }
        : conversation
    );
  
    this.oneToOneConversations = updatedOneToOneConversations;
    this.groupConversations = updatedGroupConversations;
  
    if (this.oneToOneConversations.some(c => c._id === event.conversationId)) {
      this.userService.getUserConversations().subscribe(response => {
        console.log('Updated One-to-One Conversations:', response);
        this.oneToOneConversations = response.data;
      });
    }
  
    if (this.groupConversations.some(c => c._id === event.conversationId)) {
      this.userService.getUserGropuConversations().subscribe(response => {
        console.log('Updated Group Conversations:', response);
        this.groupConversations = response.data;
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

  loadAllUsers() {
    this.userService.getAllUsersExceptCurrentUser().subscribe({
      next: response => {
        this.users = response.data;
      },
      error: error => {
        this.toastr.error(error.message, '', { timeOut: 2000 });

      }
    });
  }

  toggleGroupForm() {
    this.showGroupForm = !this.showGroupForm;
    if (this.showGroupForm) {
      this.loadAllUsers();
    }
  }

  toggleMemberSelection(userId: string) {
    if (this.selectedMembers.includes(userId)) {
      this.selectedMembers = this.selectedMembers.filter(id => id !== userId);
    } else {
      this.selectedMembers.push(userId);
    }
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length) {
      this.selectedFile = target.files[0];
    }
  }


  createGroup() {
    if (this.groupForm.invalid || this.selectedMembers.length < 2) {
      alert('Please provide a valid group name, description, and select at least 2 members.');
      return;
    }

    const groupData = {
      groupName: this.groupForm.get('groupName')?.value,
      groupAdmin: this.authService.getLoggedInUser()._id,
      members: this.selectedMembers,
      groupDescription: this.groupForm.get('groupDescription')?.value || ''
    };

    const formData = new FormData();

    formData.append('groupName', groupData.groupName);
    formData.append('groupAdmin', groupData.groupAdmin);
    formData.append('members', JSON.stringify(groupData.members));
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
      error: (error) => {
        this.toastr.error('Failed to create group.', '', { timeOut: 2000 });
        console.log(error);
      }
    });
  }






}

