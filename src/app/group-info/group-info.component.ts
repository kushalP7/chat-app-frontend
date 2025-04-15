import { Component, Input, OnInit } from '@angular/core';
import { UserService } from '../core/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';


@Component({
  selector: 'app-group-info',
  templateUrl: './group-info.component.html',
  styleUrls: ['./group-info.component.scss']
})
export class GroupInfoComponent implements OnInit {

  @Input() groupId!: string;
  group!: any;
  isLoading: Boolean = false;

  constructor(
    private userService: UserService,
    private toastr: ToastrService,
    public activeModal: NgbActiveModal
  ) { }

  ngOnInit(): void {
    this.getGroupInfo(this.groupId);
  }

  getGroupInfo(groupId: string) {
    this.isLoading = true;
    this.userService.getGroupInfo(groupId).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.group = response.data;
      },
      error: (error) => {
        this.toastr.error(`Failed to fetch group details: ${error.message || 'Unknown error'}`, '', { timeOut: 2000 });
        this.isLoading = false;
      }
    });
  }

  closeModal() {
    this.activeModal.close();
  }
}
