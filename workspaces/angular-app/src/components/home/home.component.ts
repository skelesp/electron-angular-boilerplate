import { Component } from '@angular/core';
import { ApiTesterComponent } from '../api-tester/api-tester.component';

@Component({
  selector: 'app-home',
  imports: [ApiTesterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
