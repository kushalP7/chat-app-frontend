import { Injectable } from '@angular/core';
import { HttpEvent, HttpInterceptor, HttpHandler, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor (
    private toastr : ToastrService

  ){

  }
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'An unknown error occurred!';
        if (error.error instanceof ErrorEvent) {
          errorMessage = `Error: ${error.error.message}`;
        } else {
          if (error.error.message) {
            errorMessage = error.error.message;
          } else {
            switch (error.status) {
              case 0:
                errorMessage = 'Network error or Server issue';
                break;
              case 400:
                errorMessage = 'Bad Request';
                break;
              case 401:
                errorMessage = 'Unauthorized';
                break;
              case 403:
                errorMessage = 'Access Denied !';
                break;
              case 404:
                errorMessage = 'Not Found';
                break;
              case 500:
                errorMessage = 'Internal Server Error';
                break;
              default:
                errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
            }
          }
        }

        console.log('errorMessage',errorMessage);
        this.toastr.error(error.message, '', {timeOut: 2000});            

        return throwError(errorMessage);
      })
    );
  }
}
