import { Routes } from '@angular/router';
import { HomeComponent } from '../components/home/home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent }, // Default component
  {
    // Lazily loaded: the component and everything it pulls in become their own chunk,
    // fetched the first time someone navigates here. Worth doing even in a desktop app -
    // the chunk is on local disk, but it is still parsing and executing that startup
    // doesn't pay for. Use `component:` for the screen the app opens on, `loadComponent:`
    // for the rest.
    path: 'settings',
    loadComponent: () => import('../components/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];
