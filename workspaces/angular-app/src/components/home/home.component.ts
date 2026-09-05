import { Component } from '@angular/core';
import { NotesComponent } from '../notes/notes.component';

@Component({
  selector: 'app-home',
  imports: [NotesComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {}
