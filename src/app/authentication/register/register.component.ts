import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  submitted: boolean = false;
  avatarFile!: File | null;
  avatarPreview: string | null = null;
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private toastr: ToastrService
  ) { }

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.avatarFile = input.files[0];

      const reader = new FileReader();
      reader.onload = () => {
        this.avatarPreview = reader.result as string;
      };
      reader.readAsDataURL(this.avatarFile);
    }
  }

  onSubmit() {
    this.submitted = true;
    if (this.registerForm.invalid) {
      return;
    }
    this.loading = true;
    const formData = new FormData();
    formData.append('username', this.registerForm.get('username')?.value);
    formData.append('email', this.registerForm.get('email')?.value);
    formData.append('password', this.registerForm.get('password')?.value);

    if (this.avatarFile) {
      formData.append('image', this.avatarFile);
    }

    this.authService.register(formData as any).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['auth/login']);
        this.toastr.success('Registered Successfully', '', { timeOut: 2000 });
      },
      error: (error) => {
        this.loading = false;
        this.toastr.error(error.error.message, '', { timeOut: 2000 });
      },
    }
    )
  }

  hasError(controlName: string, errorName: string): boolean {
    return this.registerForm.controls[controlName].touched && this.registerForm.controls[controlName].hasError(errorName);
  }
}
