/**
 * The grey line under an article on the dashboard. It used to show only the
 * keyword project's name, unlabelled. Projects are named after their seed
 * keyword, so "what is aeo" read as the keyword of an article targeting "ai
 * optimization" (signed-in pass 2026-10-04, finding 14). The article's own
 * keyword now leads, and the project is labelled as one.
 */
export function articleMeta(targetKeyword: string | null, projectName: string | null | undefined): string[] {
  const out: string[] = []
  const keyword = targetKeyword?.trim()
  if (keyword) out.push(`Keyword: ${keyword}`)
  const project = projectName?.trim()
  if (project && project.toLowerCase() !== keyword?.toLowerCase()) out.push(`Project: ${project}`)
  return out
}
