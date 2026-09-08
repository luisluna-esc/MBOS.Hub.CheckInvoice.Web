import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-toast-container',
  imports: [],
  templateUrl: './toast-container.html',
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
}
