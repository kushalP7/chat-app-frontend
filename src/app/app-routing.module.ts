import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { ChatroomComponent } from './chatroom/chatroom.component';
import { ChatNewComponent } from './chat-new/chat-new.component';
import { VideoCallComponent } from './video-call/video-call.component';
import { GroupCallComponent } from './group-call/group-call.component';
import { AuthGuard } from './core/guards/auth.guard';
import { JistiComponent } from './jisti/jisti.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./authentication/authentication.module').then(m => m.AuthenticationModule),
  },
  {
    path: 'test',
    component: ChatComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'chatroom',
    component: ChatroomComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'chat',
    component: ChatNewComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'video-call/:receiverId',
    component: VideoCallComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'group-call/:groupId',
    component: GroupCallComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'group-call-jitsi/:groupId',
    component: JistiComponent,
    canActivate: [AuthGuard]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
