import { Injectable } from '@angular/core';
import { Socket } from 'ngx-socket-io';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import * as mediasoupClient from 'mediasoup-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private mediasoupDevice: any;
  transportId: string = '';
  private sendTransport!: mediasoupClient.types.Transport;


  constructor(
    private socket: Socket,
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.autoReconnect();
    
  }

  connectWithToken() {
    const token = this.authService.getToken();
    if (!token) {
      this.toastr.error('No token found for WebSocket connection', '', { timeOut: 2000 });
      return;
    }

    this.socket.disconnect();

    this.socket.io.opts.query = { token };
    this.socket.connect();
  }

  autoReconnect() {
    const token = this.authService.getToken();
    if (token) {
      console.log("Attempting auto-reconnect...");
      this.connectWithToken();
    }
  }

  joinConversation(conversationId: string): void {
    this.socket.emit('joinConversation', conversationId);
  }


  uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post<{ fileUrl: string }>(`${environment.apiUrl}/upload`, formData);
  }

  sendMessage(messageData: { user: string, conversationId: string, content: string, fileUrl?: string, type: string }) {
    this.socket.emit('sendMessage', messageData);
  }


  typing(conversationId: string, userId: string): void {
    this.socket.emit('typing', conversationId, userId);

    setTimeout(() => {
      this.socket.emit('stopTyping', conversationId, userId);
    }, 2000);
  }

  receivedTyping() {
    return this.socket.fromEvent('userTyping');
  }

  newMessageReceived() {
    return this.socket.fromEvent('receiveMessage');
  }
  messagesMarkedRead() {
    return this.socket.fromEvent("messagesMarkedRead");
  }

  markMessagesAsRead(conversationId: string) {
    const userId = this.authService.getLoggedInUser()._id;
    this.socket.emit("markMessagesRead", conversationId, userId);
  }

  disconnectSocket() {
    this.socket.disconnect();
    console.log("WebSocket disconnected on logout.");
  }

  callUser(userToCall: string, signalData: any, from: string, callType: 'audio' | 'video') {
    this.socket.emit("callUser", { userToCall, signalData, from, callType });
  }


  answerCall(to: string, signal: any) {
    this.socket.emit("answerCall", { to, signal });
  }


  onIncomingCall() {
    return this.socket.fromEvent("incomingCall");
  }

  onCallAccepted() {
    return this.socket.fromEvent("callAccepted");
  }

  sendIceCandidate(userToCall: string, candidate: any) {
    this.socket.emit("iceCandidate", { userToCall, candidate });
  }

  onIceCandidate() {
    return this.socket.fromEvent("iceCandidate");
  }

  joinGroup(conversationId: string): void {
    this.socket.emit('joinConversation', conversationId);
  }
  sendGroupMessage(messageData: { user: string, conversationId: string, content: string, fileUrl?: string, type: string }) {
    this.socket.emit('sendMessage', messageData);
  }
  newGroupMessageReceived() {
    return this.socket.fromEvent('receiveMessage');
  }


  async createTransport() {
    return new Promise((resolve, reject) => {
      this.socket.emit('createTransport', {}, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          this.sendTransport = this.mediasoupDevice!.createSendTransport(response);
          resolve(response);
        }
      });
    });
  }

  async connectTransport(transportId: string, dtlsParameters: any) {
    return new Promise((resolve, reject) => {
      console.log('connectTransport', transportId, this.transportId, dtlsParameters);
      this.socket.emit('connectTransport', { transportId: this.transportId, dtlsParameters }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async produce(kind: 'audio' | 'video', track: MediaStreamTrack  ) {
    if (!this.mediasoupDevice || !this.sendTransport) {
      throw new Error("Mediasoup device or sendTransport is not initialized");
    }
  
    const producer = await this.sendTransport.produce({ track });
    return new Promise((resolve, reject) => {
      this.socket.emit('produce', { kind, rtpParameters: producer.rtpParameters  }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async consume(producerId: string, rtpCapabilities: any) {
    return new Promise((resolve, reject) => {
      this.socket.emit('consume', { producerId, rtpCapabilities }, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });
    });
  }

  async initializeMediasoupDevice(rtpCapabilities: any) {
    this.mediasoupDevice = new mediasoupClient.Device();
    await this.mediasoupDevice.load({ routerRtpCapabilities: rtpCapabilities });
  }



  getMediasoupDevice(): mediasoupClient.Device | null {
    return this.mediasoupDevice;
  }

  onNewParticipant() {
    return this.socket.fromEvent('newParticipant');
  }

  getParticipants(groupId: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.socket.emit('getParticipants', groupId, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response.participants);
        }
      });
    });
  }

getRouterRtpCapabilities() {
  return new Promise<any>((resolve, reject) => {
    this.socket.emit('getRouterRtpCapabilities', {}, (response: any) => {
      console.log('Received router RTP capabilities response:', response);

      if (response.error) {
        reject(response.error);
      } else {
        resolve(response.rtpCapabilities);
      }
    });
  });
}
  


}
