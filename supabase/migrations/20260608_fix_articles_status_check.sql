-- Fix: articles were getting stranded in status='generating'.
--
-- The generate-draft route drives a multi-stage lifecycle
--   generating -> expanding -> polishing -> ready
-- but the original articles_status_check constraint only permitted
--   ('draft','brief_ready','generating','complete','published').
-- So every write of 'expanding'/'polishing' failed silently, and the final
-- write of 'ready' was rejected outright (constraint violation) -> the route
-- returned 500 and the article was left stuck in 'generating'.
--
-- Expand the constraint to allow the full lifecycle. 'complete' and 'published'
-- are kept for backward compatibility (existing rows + the publish flow).

alter table public.articles
  drop constraint if exists articles_status_check;

alter table public.articles
  add constraint articles_status_check
  check (status in (
    'draft',
    'brief_ready',
    'generating',
    'expanding',
    'polishing',
    'ready',
    'complete',
    'published'
  ));
