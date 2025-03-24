import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatComponent } from './chat/chat.component';
import { ChatroomComponent } from './chatroom/chatroom.component';
import { ChatNewComponent } from './chat-new/chat-new.component';

const routes: Routes = [
  {
    path:'',
    redirectTo:'auth',
    pathMatch:'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./authentication/authentication.module').then(m => m.AuthenticationModule),
  },
  { 
    path: 'test', 
    component: ChatComponent, 
    // canActivate: [AuthGuard] 
  },
  { 
    path: 'chatroom', 
    component: ChatroomComponent, 
    // canActivate: [AuthGuard] 
  },
  {
    path : 'chat',
    component : ChatNewComponent
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
