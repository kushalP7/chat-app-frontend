import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-group-call',
  templateUrl: './group-call.component.html',
  styleUrls: ['./group-call.component.scss']
})
export class GroupCallComponent implements OnInit, OnDestroy {
  @ViewChild("localVideo") localVideo!: ElementRef;
  @ViewChild("remoteVideos") remoteVideosContainer!: ElementRef;

  groupId!: string;
  participants: { userId: string, stream: MediaStream }[] = [];
  localStream!: MediaStream;
  peerConnections: { [key: string]: RTCPeerConnection } = {};
  isCallInitiator = false;
  isMuted = false;
  isVideoEnabled = true;
  isScreenSharing = false;
  screenStream: MediaStream | null = null;

  private iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  constructor(
    private socketService: SocketService,
    public authService: AuthService,
    private toastr: ToastrService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  async ngOnInit() {
    console.log('participants', this.participants);

    this.groupId = this.route.snapshot.params['groupId'];
    this.isCallInitiator = this.route.snapshot.queryParams['initiator'] === 'true';

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      this.setupLocalVideo();

      if (this.isCallInitiator) {
        this.startGroupCall();
      } else {
        this.joinGroupCall();
      }

      this.setupSocketListeners();
    } catch (error) {
      // console.error('Error initializing group call:', error);
      // this.toastr.error('Failed to start group call');
      // this.router.navigate(['/chat']);
    }
  }

  private setupLocalVideo() {
    if (this.localVideo?.nativeElement) {
      this.localVideo.nativeElement.srcObject = this.localStream;
      this.localVideo.nativeElement.muted = true;
    }
  }

  private async startGroupCall() {
    this.socketService.startGroupCall(this.groupId, this.authService.getLoggedInUser()._id);
  }

  private async joinGroupCall() {
    this.socketService.joinGroupCall(this.groupId, this.authService.getLoggedInUser()._id);
  }

  private setupSocketListeners() {
    this.socketService.onGroupCallParticipantJoined().subscribe(async (data: any) => {
      const { userId } = data;
      if (userId === this.authService.getLoggedInUser()._id) return;

      const pc = new RTCPeerConnection(this.iceServers);
      this.peerConnections[userId] = pc;

      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socketService.sendGroupCallIceCandidate(this.groupId, userId, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        this.handleRemoteStream(userId, event.streams[0]);
      };

      if (this.isCallInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socketService.sendGroupCallOffer(this.groupId, userId, offer);
      }
    });

    this.socketService.onGroupCallOffer().subscribe(async (data: any) => {
      const { fromUserId, offer } = data;
      const pc = this.peerConnections[fromUserId] || new RTCPeerConnection(this.iceServers);
      this.peerConnections[fromUserId] = pc;

      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socketService.sendGroupCallIceCandidate(this.groupId, fromUserId, event.candidate);
        }
      };

      pc.ontrack = (event) => {
        this.handleRemoteStream(fromUserId, event.streams[0]);
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.socketService.sendGroupCallAnswer(this.groupId, fromUserId, answer);
    });

    this.socketService.onGroupCallAnswer().subscribe(async (data: any) => {
      const { fromUserId, answer } = data;
      const pc = this.peerConnections[fromUserId];
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } else {
        console.warn('Skipping setting remote answer: Invalid state or no peer connection');
      }
      
    });

    this.socketService.onGroupCallIceCandidate().subscribe((data: any) => {
      const { fromUserId, candidate } = data;
      const pc = this.peerConnections[fromUserId];
      if (pc) {
        pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    this.socketService.onGroupCallParticipantLeft().subscribe((data: any) => {
      const { userId } = data;
      this.removeParticipant(userId);
    });
  }

  private handleRemoteStream(userId: string, stream: MediaStream) {
    const existingParticipant = this.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.stream = stream;
    } else {
      this.participants.push({ userId, stream });
    }
  }

  private removeParticipant(userId: string) {
    this.participants = this.participants.filter(p => p.userId !== userId);
    if (this.peerConnections[userId]) {
      this.peerConnections[userId].close();
      delete this.peerConnections[userId];
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

      Object.keys(this.peerConnections).forEach(userId => {
        const pc = this.peerConnections[userId];
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(this.screenStream!.getVideoTracks()[0]);
        }
      });

      this.isScreenSharing = true;
      this.screenStream.getVideoTracks()[0].onended = () => this.stopScreenShare();
    } catch (error) {
      console.error('Error starting screen share:', error);
      this.toastr.error('Failed to start screen sharing');
    }
  }

  async stopScreenShare() {
    if (!this.isScreenSharing) return;

    this.screenStream?.getTracks().forEach(track => track.stop());

    Object.keys(this.peerConnections).forEach(userId => {
      const pc = this.peerConnections[userId];
      const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
      if (videoSender && this.localStream) {
        videoSender.replaceTrack(this.localStream.getVideoTracks()[0]);
      }
    });

    this.isScreenSharing = false;
    this.screenStream = null;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = !this.isMuted;
    });
  }

  toggleVideo() {
    this.isVideoEnabled = !this.isVideoEnabled;
    this.localStream.getVideoTracks().forEach(track => {
      track.enabled = this.isVideoEnabled;
    });
  }

  leaveCall() {
    this.socketService.leaveGroupCall(this.groupId, this.authService.getLoggedInUser()._id);
    this.cleanUp();
    this.router.navigate(['/chat']);
  }

  private cleanUp() {
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};

    this.localStream?.getTracks().forEach(track => track.stop());
    this.screenStream?.getTracks().forEach(track => track.stop());

    this.participants = [];
  }

  ngOnDestroy() {
    this.leaveCall();
  }
}