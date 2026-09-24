# Show authenticated nav links on homepage

- Session `d6d65455-b107-4ac4-b075-00fcc8c282dc`
- 2026-06-16 08:53 to 2026-06-16 08:54
- Branch: `master`  |  Claude Code 2.1.170

**Commits made:**

- `Nav: show Dashboard/Settings/Help for logged-in users on homepage`

**Files touched (2):** `src/app/page.tsx`, `src/app/_components/NavLinks.tsx`

---


## Michael

The homepage navbar always shows "Pricing / Log in / Get started" regardless of auth state. When a user is already logged in it should show "Help / Settings / Dashboard" instead.

Specifically:
- "Pricing" link → "Help" (link to support or mailto:hi@bylineseo.com, or /support if that route exists)
- "Log in" → "Settings" (link to /settings)
- "Get started" button → "Dashboard" button (link to /dashboard)

**Step 1 — Find the homepage navbar**
The site is at app.bylineseo.com. Find the marketing homepage and its nav component:
```
dir src\app\(marketing)\ /s /b 2>nul
dir src\app\(home)\ /s /b 2>nul
dir src\components\ /s /b 2>nul
```
Look for a Navbar, Header, or Nav component used on the homepage/layout.

**Step 2 — Add auth detection**
The navbar needs to detect if the user is logged in. Use the Supabase client-side hook pattern already used elsewhere in the codebase (look for `useUser`, `createBrowserClient`, or `supabase.auth.getUser()` examples).

Make it a client component (`'use client'`) if it isn't already, or extract just the auth-aware CTA portion into a small client component to keep SSR intact.

**Step 3 — Implement conditional rendering**
When `user` is null (logged out): show existing "Pricing / Log in / Get started"
When `user` is set (logged in): show "Help / Settings / Dashboard"

For "Help" link: check if `/support` or `/help` route exists; if not, use `mailto:hi@bylineseo.com` or just link to the support widget anchor. Keep it simple.

**Step 4 — Commit and deploy**
```
git pull --rebase origin master
git add <changed files>
git diff --stat HEAD
git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Nav: show Dashboard/Settings/Help for logged-in users on homepage"
git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" push origin master
curl -X POST "https://api.vercel.com/v1/integrations/deploy/prj_DkQtXvVAVjzwC5qH2RqPfOG7vktr/HCPNWt1KoS"
```

Read ARCHITECTURE.md first if it exists. Commit author MUST be michaeljacobosborne@gmail.com. Don't touch unrelated files.

**Claude:** I'll start by reading ARCHITECTURE.md, then find the homepage navbar.

> `Bash: cat ARCHITECTURE.md 2>/dev/null | head -100; echo "---ROUTES---"; ls "src/app" 2>/dev/null`

> `Bash: find "src/app/(marketing)" -type f 2>/dev/null; echo "---HOMEPAGE PAGE---"; head -5 "src/app/page.tsx" 2>/dev/null; echo "---COMPONENTS---"; ls src/app/_compone`

> `Grep: Pricing|Log in|Get started|nav|Nav`

> `Read: src/app/page.tsx`

**Claude:** The homepage is a server component. I'll extract the nav links into a small client component. Let me check the Supabase client pattern and whether a support route exists.

> `Bash: cat src/lib/supabase/client.ts 2>/dev/null; echo "---SUPPORT ROUTE---"; ls "src/app/(marketing)/support" "src/app/support" "src/app/help" 2>/dev/null; echo "(no`

> `Bash: grep -n "createClient\|getUser\|useState\|useEffect" "src/app/(dashboard)/dashboard/page.tsx" | head -20`

> `Bash: grep -n "createClient\|getUser\|'use client'\|useEffect\|useState" "src/app/(billing)/pricing/page.tsx" | head -20`

> `Bash: grep -rn "auth.getUser\|onAuthStateChange" "src/app/(dashboard)/articles/page.tsx" "src/app/(dashboard)/layout.tsx" 2>/dev/null | head`

**Claude:** I have enough context. No `/support` route exists, so Help → `mailto:hi@bylineseo.com`. Let me create a small client component for the auth-aware nav links.

> `Write: src/app/_components/NavLinks.tsx`

**Claude:** Let me verify the `/settings` and `/dashboard` routes exist before wiring it in.

> `Bash: find "src/app/(dashboard)" -maxdepth 2 -name "page.tsx" | grep -iE "settings|dashboard"; echo "---settings anywhere---"; find src/app -type d -iname "settings"`

**Claude:** Both routes exist. Now wire the component into the homepage nav.

> `Edit: src/app/page.tsx`

> `Edit: src/app/page.tsx`

**Claude:** Both links resolve. `Link` is still used elsewhere in `page.tsx`, so the import stays. Now commit and deploy.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git pull --rebase origin master 2>&1 | tail -15`

**Claude:** Other sessions have unstaged changes. I'll stage only my files, then use autostash for the rebase.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git add src/app/_components/NavLinks.tsx "src/app/page.tsx" && git diff --stat HEAD -- src/app/_components/NavL`

**Claude:** Only my two files are staged. Now commit, then rebase with autostash for the unrelated changes.

> `Bash: cd "C:/Users/ozzy5/OneDrive/Documents/Byline" && git -c user.email=michaeljacobosborne@gmail.com -c user.name="Michael Osborne" commit -m "Nav: show Dashboard/S`
