import { APP_INITIALIZER, NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { SocketIoModule } from 'ngx-socket-io';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ToastrModule } from 'ngx-toastr';
import { environment } from 'src/environments/environment';
import { SimplebarAngularModule } from 'simplebar-angular';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { ErrorInterceptor } from './core/interceptors/error.interceptor';
import { ServiceWorkerModule } from '@angular/service-worker';
import { UserService } from './core/services/user.service';

const socketConfig = {
  url: environment.apiUrl,
  options: {
    transports: ['websocket', 'polling'] 
  },
  secure: true,
  
};
// function getUsers(userService: UserService) {
//   return () => {
//     return new Promise((resolve, reject) => {
//       userService.getUsers().subscribe({
//         next: (response) => {
//           userService.users = response;
//           resolve(true);
//         },
//         error: (error) => {
//           console.error('Error fetching users:', error);
//           reject(false);
//         }
//       });
//     });
//   };
// }
@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    ToastrModule.forRoot(),
    BrowserAnimationsModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    CommonModule,
    SocketIoModule.forRoot(socketConfig),
    SimplebarAngularModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    }),
  ],
  providers: [
    // {provide:APP_INITIALIZER,useFactory:getUsers,deps:[UserService],multi:true},
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }