import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { IUser } from 'src/app/core/interfaces/userInterface';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  summited: boolean = false;
  formData: any = [];
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastr: ToastrService
  ) { }
  ngOnInit(): void {
    this.registerForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    })
  }

  onSubmit() {
    this.summited = true;
    if (this.registerForm.invalid) {
      return
    }
    this.formData.push(this.registerForm.value);

    const user: IUser = {
      username: this.registerForm.get('userName')?.value,
      email: this.registerForm.get('email')?.value,
      password: this.registerForm.get('password')?.value,
      isOnline: false,
    }
    this.authService.register(user).subscribe(
      response => {
        this.router.navigate(['auth/login'])
        this.toastr.success('Register Successfully', '', { timeOut: 2000 });

      },
      error => {
        console.log(error);
        this.toastr.error(error.message, '', {timeOut: 2000});            

        
      }

    )


  }

  hasError(controlName: string, errorName: string): boolean {
    return this.registerForm.controls[controlName].touched && this.registerForm.controls[controlName].hasError(errorName);
  }
}
