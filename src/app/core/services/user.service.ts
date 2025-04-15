import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IUser } from '../interfaces/user';
import { IConversation } from '../interfaces/conversation';
import { IApiResponse } from '../interfaces/apiResponse';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = environment.apiUrl;
  private tokenKey = 'auth_token';

  constructor(private http: HttpClient) { }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  groupCreatHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getUsers(): Observable<IUser[]> {
    return this.http.get<IUser[]>(`${this.apiUrl}/web/users`, { headers: this.getHeaders() });
  }

  getUserConversations(): Observable<IApiResponse<IConversation[]>> {
    return this.http.get<IApiResponse<IConversation[]>>(`${this.apiUrl}/conversations`, { headers: this.getHeaders() });
  }

  getMessages(conversationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/${conversationId}`, { headers: this.getHeaders() });
  }

  getUserById(userId: string): Observable<IApiResponse<IUser>> {
    return this.http.get<IApiResponse<IUser>>(`${this.apiUrl}/web/user/${userId}`, { headers: this.getHeaders() });
  }

  getAllUsersExceptCurrentUser(): Observable<IApiResponse<IUser[]>> {
    return this.http.get<IApiResponse<IUser[]>>(`${this.apiUrl}/web/users/except-current`, { headers: this.getHeaders() });
  }

  createOrGetConversation(receiverId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/conversations`, { receiverId }, { headers: this.getHeaders() });
  }

  createGroup(formData: FormData): Observable<IApiResponse<IConversation>> {
    return this.http.post<IApiResponse<IConversation>>(`${this.apiUrl}/conversations/group`, formData, {headers: this.groupCreatHeaders()});
  }

  addMembersToGroup(conversationId: string, userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/conversations/group/${conversationId}/add`, { userId }, { headers: this.getHeaders() });
  }

  getUserGropuConversations(): Observable<IApiResponse<IConversation[]>> {
    return this.http.get<IApiResponse<IConversation[]>>(`${this.apiUrl}/groupConversations`, { headers: this.getHeaders() });
  }

  getGroupInfo(conversationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/conversations/${conversationId}/group`, { headers: this.getHeaders() });
  }

  deleteMessage(messageId: string): Observable<IApiResponse<null>> {
    return this.http.delete<IApiResponse<null>>(`${this.apiUrl}/messages/${messageId}`, { headers: this.getHeaders() });
  }

  deleteConversation(conversationId: string): Observable<IApiResponse<null>> {
    return this.http.delete<IApiResponse<null>>(`${this.apiUrl}/conversations/${conversationId}`, { headers: this.getHeaders() });
  }
}
