import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

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

  groupCreatHeaders():HttpHeaders{
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getUsers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/web/users`, { headers: this.getHeaders() });
  }

  getUserConversations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/conversations`, { headers: this.getHeaders() });
  }

  getMessages(conversationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/messages/${conversationId}`, { headers: this.getHeaders() });
  }

  getUserById(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/web/user/${userId}`, { headers: this.getHeaders() });
  }

  getAllUsersExceptCurrentUser(): Observable<any> {
    return this.http.get(`${this.apiUrl}/web/users/except-current`, { headers: this.getHeaders() });
  }

  createOrGetConversation(receiverId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/conversations`, { receiverId }, { headers: this.getHeaders() });
  }

  createGroup(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/conversations/group`, formData, {headers: this.groupCreatHeaders()});
  }

  addMembersToGroup(conversationId: string, userId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/conversations/group/${conversationId}/add`, { userId }, { headers: this.getHeaders() });
  }

  getUserGropuConversations(): Observable<any> {
    return this.http.get(`${this.apiUrl}/groupConversations`, { headers: this.getHeaders() });
  }

  getGroupInfo(conversationId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/conversation/${conversationId}/group`, { headers: this.getHeaders() });
  }


}
