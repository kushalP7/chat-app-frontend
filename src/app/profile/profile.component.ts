import { Component, Input, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../core/services/user.service';
import { IUser } from '../core/interfaces/user';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {

  @Input() userId!: string;
  user!: IUser;
  isLoading: Boolean = false;

  constructor(
    private userService: UserService,
    private toastr: ToastrService,
    public activeModal: NgbActiveModal
  ) { }

  ngOnInit(): void {
    this.getUserData(this.userId);
  }

  getUserData(userId: string) {
    this.isLoading = true;
    this.userService.getUserById(userId).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.user = response.data;
      },
      error: (error) => {
        this.isLoading = false;
        this.toastr.error(`Failed to fetch user details: ${error.message || 'Unknown error'}`, '', { timeOut: 2000 });
      }
    });
  }

  closeModal() {
    this.activeModal.close();
  }
}
