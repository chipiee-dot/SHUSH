# SHUSH orange-gold-cloud: test plan

## Commands
```bash
npm run build --prefix client
npm test --prefix server
npm run dev        # then open http://localhost:5173
```

## Sweeps (each must return nothing)
```bash
grep -rn "#1b2d5a\|#152549\|#16254a\|#14234b\|#d6cfbe\|#f1ede3\|#f7f5ed\|#ece7da\|#273b6b\|#152754\|#111f3e\|#0f1b3a\|#5b4bdb\|#6a5be6" client/src
grep -rnE "emerald-|sky-|blue-|indigo-|violet-|purple-|slate-" client/src
grep -rn "Quiet-Zone Console\|System Online\|18 Nodes Active\|landing-pill\|status-dot" client/src
```

## Responsive QA (record pass/fail)
| Screen | 1440 | 1366 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- | --- |
| Welcome `/` | card ~1080px, no pill | fits | fits | stacks | no h-scroll |
| Faculty login `/login` | card ~1180px, no badge | fits | fits | stacks | no h-scroll |
| Faculty signup `/signup` | ~1120px, 42/58 | fits | fits | stacks | no h-scroll |
| Student login `/student/login` | two columns ~896px | fits | hero hides | stacked | no h-scroll |
| Student signup `/student/signup` | ~896px | fits | fits | stacked | no h-scroll |
| Student table `/student/table` | tiles clear | fits | fits | 2-col | 1-col |
| Faculty console | orange rail | fits | rail collapses | mobile nav | mobile nav |

Also: Tab shows orange focus rings everywhere; `prefers-reduced-motion` stops animations; no console errors.
