import { Component, Input, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProfileComponent } from '../profile/profile.component';
import { UserService } from 'src/app/core/services/user.service';


@Component({
  selector: 'app-group-info',
  templateUrl: './group-info.component.html',
  styleUrls: ['./group-info.component.scss']
})
export class GroupInfoComponent implements OnInit {

  @Input() groupId!: string;
  group!: any;
  isLoading: Boolean = false;

  showAddMembers: boolean = false;
  allUsers: any[] = [];
  selectedUserIds: Set<string> = new Set();
  @ViewChild('addMembersModal') addMembersModalRef!: TemplateRef<any>;


  constructor(
    private userService: UserService,
    private toastr: ToastrService,
    public activeModal: NgbActiveModal,
    private modalService: NgbModal

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
        this.toastr.error(`${error || 'Unknown error'}`, '', { timeOut: 2000 });
        this.isLoading = false;
      }
    });
  }

  closeModal() {
    this.activeModal.close();
  }

  toggleUserSelection(userId: string) {
    if (this.selectedUserIds.has(userId)) {
      this.selectedUserIds.delete(userId);
    } else {
      this.selectedUserIds.add(userId);
    }
  }

  fetchUsers() {
    this.userService.getAllUsersExceptCurrentUser().subscribe({
      next: (res) => {
        this.allUsers = res.data;
      },
      error: (error) => {
        this.toastr.error(`${error || 'Unknown error'}`, '', { timeOut: 2000 });
      }
    });
  }


  addSelectedUsers() {
    const userIds = Array.from(this.selectedUserIds);
    if (!userIds.length) return;

    this.userService.addMembersToGroup(this.groupId, userIds).subscribe({
      next: () => {
        this.toastr.success("Members added successfully");
        this.getGroupInfo(this.groupId);
        this.selectedUserIds.clear();
        this.showAddMembers = false;
      },
      error: (error) => {
        this.toastr.error(`${error || 'Unknown error'}`, '', { timeOut: 2000 });
      }
    });
  }

  openAddMembersModal() {
    if (this.allUsers.length === 0) {
      this.fetchUsers();
    }
    this.modalService.open(this.addMembersModalRef, {
      centered: true,
      backdrop: 'static',
      size: 'lg'
    });
  }

  removeMember(userId: string) {
    this.userService.removeMemberFromGroup(this.groupId, userId).subscribe({
      next: () => {
        this.toastr.success("Member removed successfully");
        this.getGroupInfo(this.groupId);
      },
      error: (error) => {
        this.toastr.error(`${error || 'Unknown error'}`, '', { timeOut: 2000 });
      }
    });
  }

  makeGroupAdmin(userId: string) {
    this.toastr.info("This feature is currently under development.", '', { timeOut: 2000 });
  }

  openUserProfile(userId: string) {
    const modalRef = this.modalService.open(ProfileComponent, {
      windowClass: 'custom-modal'
    });

    modalRef.componentInstance.userId = userId;
    modalRef.componentInstance.modalRef = modalRef;
  }
}
