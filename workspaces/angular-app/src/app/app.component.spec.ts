import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, beforeEach, it, expect } from 'vitest';
import { AppComponent } from './app.component';
import { routes } from './app.routes';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'angular-app' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.appName).toEqual('Electron Angular Boilerplate');
  });

  it('links to both routes', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLAnchorElement).getAttribute('href')
    );
    expect(hrefs).toEqual(['/', '/settings']);
  });
});
