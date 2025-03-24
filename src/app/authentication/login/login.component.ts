import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';
import { SocketService } from 'src/app/core/services/socket.service';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.scss']
})

export class LoginComponent implements OnInit {

    loginForm!: FormGroup;
    summited: boolean = false;
    formData: any = [];

    constructor(
        private fb: FormBuilder, 
        private router: Router, 
        private authService: AuthService, 
        private socketService: SocketService,
        private toastr : ToastrService
    ) { }
    ngOnInit(): void {
        this.loginForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required]]
        });
    }

    onSubmit() {
        this.summited = true;
        if (this.loginForm.invalid) {
            return;
        }
        const email = this.loginForm.get('email')?.value;
        const password = this.loginForm.get('password')?.value;
        this.authService.loginUser(email, password).subscribe({
            next: (response) => {
                const token = response.data.token;
                if (token) {
                    this.socketService.connectWithToken();
                    this.router.navigate(['/chat']);
                }
                this.toastr.success('Login Successfully', '', {timeOut: 2000});

            },
            error: (error) => {
                this.toastr.error(error.message, '', {timeOut: 2000});            
            }
        });
    }

    hasError(controlName: string, errorName: string): boolean {
        return this.loginForm.controls[controlName].touched && this.loginForm.controls[controlName].hasError(errorName);
    }
}