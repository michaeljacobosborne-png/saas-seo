# Draft: in-product notice for the score change (decision 4: announce, do not migrate quietly)

Status: DRAFT for review. Labels in [brackets] wait on decision 2 (likely Retrievable / Citable).
Where it shows: a dismissible banner above the scores in the article editor, shown once per account,
plus the same text as a short email to existing customers. Dismissal stored per user.

---

## Banner (editor)

**Your article scores now use the same engine as our free analyzer.**

Until today, the GEO and AEO bars in the editor came from nine simple pattern checks. They have been
replaced by the engine behind our public GEO analyzer. It scores every finding against evidence in
your draft and tells you what it could not check.

Most articles will score lower than before. Your content has not changed. The old checks were more
generous than they should have been, and we would rather tell you that than quietly move the numbers.

What is different:
- **[Retrievable]** is a number. It covers 45 of the 100 points we score on a live page: how your
  draft is structured and how cleanly an answer can be lifted from it. The other 55 (crawler access,
  server rendering, structured data) can only be checked once the article is published.
- **[Citable]** is a band, not a number. It shows whether anything in the draft carries attribution
  back to you: your brand name next to your claims, original figures, terms that are yours, and a
  named author.
- Every finding shows the text it is based on, so you can check it yourself.

None of this measures whether an AI system has cited you. Nobody can measure that from a draft.
It measures whether your content is ready to be quoted and credited.

[Got it]   [How scoring works →]

---

## Email (existing customers)

Subject: Your Byline scores have changed, and why

Hi {first_name},

The GEO and AEO scores in your Byline editor now come from the same engine as our free GEO analyzer,
instead of the simpler checks they used before.

Most articles will show a lower score. Your writing has not got worse. The old checks gave credit too
easily, and we would rather say that plainly than lower your numbers without telling you.

Three things to know:
1. A draft is scored on 45 of the 100 points we use for a published page. Crawler access and page
   markup are checked after you publish, and the editor says so next to the score.
2. Every finding now shows the passage it is based on.
3. Citability, meaning whether quoted content carries your name with it, is now scored separately
   from structure. It is usually the faster win.

Nothing about your articles has been changed or rewritten.

Michael

---

## Review notes

- Says plainly that scores will drop and why. No quiet migration (decision 4).
- No claim about AI visibility or citation; it explicitly says that is not measured (invariant 8).
- No numbers promised, and no "improve your rankings".
- Open: whether the email goes from Michael personally, and the exact send date relative to the deploy.
