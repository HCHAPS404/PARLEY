# Project conventions

- Language: TypeScript strict; ESM; `src/` with `@/*` alias.
- Money: integer cents in code and DB; USD in agent tool inputs and user-facing text.
- Errors: agent tools return `{ error: string }` objects rather than throwing — the model needs readable failures.
- Verification before finishing any task: `npx tsc --noEmit` must pass, and `npm run dev` should compile the touched routes.
- Design: paper/ink/teal tokens in `globals.css` (`@theme`); Space Grotesk display + Inter UI; lucide icons only; no gradients/glassmorphism/generic AI patterns.
- Docs: README is a submission artifact — features, setup, tools-used, and sandbox test credentials must stay accurate.
- Commits: conventional style (`feat:`, `fix:`, `chore:`), imperative, concise.
- Git authorship (hard rule, non-negotiable per owner): every commit uses `Helmut Chaparro <helmut.chs@gmail.com>` as author AND committer. No AI/agent attribution — no "Generated with", no Co-Authored-By trailers, no bot identities anywhere in history. Verify with `git log --format="%an <%ae>"` before pushing.
