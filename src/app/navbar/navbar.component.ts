import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { SocketService } from '../core/services/socket.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  isCollapsed: boolean = false;
  constructor(
    private router: Router,
    public authService: AuthService,
    private socketService: SocketService,
    private toastr : ToastrService

  ) { }

  ngOnInit() {
  }

  onLogoutClick() {
    this.socketService.disconnectSocket();
    this.authService.logout();
    this.toastr.success('Logout Successfully', '', {timeOut: 2000});            

  }


}
