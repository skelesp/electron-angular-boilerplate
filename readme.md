# Electron + Angular Boilerplate

A starting point for a desktop app: Angular frontend, Electron main process, a SQLite
database via TypeORM, and a **shared, runtime-validated API contract** between the two
(zod schemas double as the source of truth for both the TypeScript types and the IPC
input validation).

This is a **template repository**. Click "Use this template" on GitHub to start a new,
fully independent project from it - the new repo has no shared history or dependency
on this one, so upgrading this boilerplate later (Angular, Electron, TypeORM, ...)
never affects projects already created from it.

## Project structure

```
/
├── workspaces/
│   ├── angular-app/     # Angular frontend (renderer process)
│   ├── electron-app/    # Electron main process + SQLite/TypeORM
│   └── shared/          # API contract: zod schemas, types, IPC channel registry
├── package.json         # npm workspaces root
└── tsconfig.json
```

### How the API contract works

- `shared/src/apiDefinition/<domain>/types.ts` defines zod schemas (and the types
  inferred from them) for one domain's input/output.
- `shared/src/apiDefinition/<domain>/endpoints.ts` maps each action to an IPC channel
  name and its schemas.
- `shared/src/apiDefinition/registry.ts` combines every domain into `apiRegistry`
  (runtime) and `AppApiRegistry` (compile-time).
- `electron-app`'s `handlersRegistry.ts` validates every incoming IPC payload against
  its channel's zod schema before the handler runs, and always returns an
  `ApiResponse<T>` envelope (`{status: 'success', data} | {status: 'error', error}`) -
  handlers themselves can just throw.
- `angular-app`'s `ElectronService.invoke(channel, data)` is fully typed against
  `AppApiRegistry`, so a mismatched payload or channel is a compile error, not a
  runtime surprise.

A minimal example domain (`note`: create/get/list/delete) is included end-to-end -
shared schema, electron-app TypeORM entity/repository/handler, and an Angular
service + `ApiTesterComponent` - to demonstrate the pattern. Replace it with your own
domain(s).

## Adding a new API domain

**Shared**

1. Create `shared/src/apiDefinition/<domain>/types.ts` and `endpoints.ts`.
2. Define the input/output zod schemas in `types.ts`.
3. Define the channel names and endpoint registry in `endpoints.ts`.
4. Add the domain to `apiRegistry` and `AppApiRegistry` in `registry.ts`.

**Electron app**

5. Create the TypeORM entity/repository under `electron-app/src/models/<domain>/`.
6. Add the entity to `entities` in `database/sqlite.config.ts`.
7. Create a `<domain>.handler.ts` implementing one handler per endpoint.
8. Spread the handler's exported object into `handlersRegistry` in `handlersRegistry.ts`.

**Angular app**

9. Add a `<domain>.service.ts` under `services/` that calls `ElectronService.invoke(...)`.
10. Use it from a component.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- npm

### Getting started

```
npm install
npm start
```

This runs the shared package in watch mode, `ng serve`, and Electron concurrently.
The Electron window loads `http://localhost:4200`.

### Useful scripts

- `npm run build:shared` / `build:electron-app` / `build:angular-app`
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`

## License

MIT
