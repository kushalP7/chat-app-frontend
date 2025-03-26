import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SocketIoConfig, SocketIoModule } from 'ngx-socket-io';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ChatComponent } from './chat/chat.component';
import { ChatroomComponent } from './chatroom/chatroom.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { ChatNewComponent } from './chat-new/chat-new.component';
import { SimplebarAngularModule } from 'simplebar-angular';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

const socketConfig: SocketIoConfig = {
  url: environment.apiUrl,

};
const config: SocketIoConfig = {
  url: 'wss://chat-app-backend-3xyk.onrender.com',
  options: {
    transports: ['websocket', 'polling'] 
  }
};
@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    ChatroomComponent,
    ChatNewComponent,
  ],
  imports: [
    ToastrModule.forRoot(),
    BrowserAnimationsModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    SocketIoModule.forRoot(config),
    FormsModule,
    ReactiveFormsModule,
    SimplebarAngularModule,
    NgbModule,

  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
  