import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SocketIoModule } from 'ngx-socket-io';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ChatComponent } from './chat/chat.component';
import { ChatroomComponent } from './chatroom/chatroom.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { ChatNewComponent } from './chat-new/chat-new.component';
import { SimplebarAngularModule } from 'simplebar-angular';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { VideoCallComponent } from './video-call/video-call.component';
import { GroupCallComponent } from './group-call/group-call.component';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { ErrorInterceptor } from './core/interceptors/error.interceptor';
import { ServiceWorkerModule } from '@angular/service-worker';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';


const socketConfig = {
  url: environment.apiUrl,
  options: {
    transports: ['websocket', 'polling'] 
  },
  secure: true,
  
};

@NgModule({
  declarations: [
    AppComponent,
    ChatComponent,
    ChatroomComponent,
    ChatNewComponent,
    VideoCallComponent,
    GroupCallComponent,
  ],
  imports: [
    ToastrModule.forRoot(),
    BrowserAnimationsModule,
    NgxSkeletonLoaderModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    SocketIoModule.forRoot(socketConfig),
    FormsModule,
    ReactiveFormsModule,
    SimplebarAngularModule,
    NgbModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }