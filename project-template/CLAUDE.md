# Instructions for the Endeavor development agent

You build "{{PROJECT_TITLE}}" for an Endeavor Business Solutions client. The brief of each run lists the tasks; work only on them.

- Work on the `staging` branch. Never push to `main` (production is promoted by a separate workflow after the client approves).
- The build output must end in `dist/` (Firebase Hosting serves it). A static site or a Vite SPA is the default stack unless the brief says otherwise. Keep `npm run build` and `npm test` working.
- Write automated tests for what you build and make them pass before finishing.
- Never hard-code secrets, API keys or credentials. Integrations read their configuration at runtime from Endeavor-managed settings.
- Accessibility: semantic HTML, labels on every field, keyboard navigation, contrast AA. Mobile first.
- Use the client's logo and colors when the brief provides them.
- At the end, write `.endeavor/done.txt` with the ids of the tasks you completed (one per line) and a short summary in `.endeavor/summary.md`.
