# ASSBar

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.1.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Local API (match Static Web Apps behavior)

This app expects API calls at `/api/*`.
During local development, Angular now proxies `/api` to Azure Functions at `http://localhost:7071`.

1. Install Azure Functions Core Tools (if not already installed).
2. In the `api/` folder, create `local.settings.json` from `local.settings.sample.json` and fill in your storage connection string.
3. Start the Functions host from the `api/` folder:

```bash
func start
```

4. In a second terminal at the project root, start the frontend:

```bash
ng serve
```

With both processes running, `http://localhost:4200/api/events` should return JSON from the local API (not `index.html`).

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
