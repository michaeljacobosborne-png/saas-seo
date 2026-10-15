import { defineArrayMember, defineField, defineType } from 'sanity'

export const post = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  groups: [
    { name: 'content', title: 'Content', default: true },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'content',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'content',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'reference',
      group: 'content',
      to: [{ type: 'author' }],
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      group: 'content',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Important for SEO and accessibility.',
        }),
      ],
    }),
    defineField({
      name: 'categories',
      title: 'Categories / Tags',
      type: 'array',
      group: 'content',
      of: [defineArrayMember({ type: 'reference', to: [{ type: 'category' }] })],
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published at',
      type: 'datetime',
      group: 'content',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Excerpt',
      type: 'text',
      rows: 3,
      group: 'content',
      description: 'Used for the card preview and meta description.',
      validation: (rule) => rule.max(300),
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      group: 'content',
      of: [
        defineArrayMember({
          type: 'block',
          marks: {
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [
                  {
                    name: 'href',
                    type: 'url',
                    title: 'URL',
                    validation: (rule) =>
                      rule.uri({ scheme: ['http', 'https', 'mailto', 'tel'] }),
                  },
                ],
              },
            ],
          },
        }),
        defineArrayMember({
          type: 'image',
          options: { hotspot: true },
          fields: [
            defineField({ name: 'alt', title: 'Alt text', type: 'string' }),
            defineField({ name: 'caption', title: 'Caption', type: 'string' }),
          ],
        }),
        // FAQ Q&A block — rendered as an accordion and emitted as FAQPage
        // structured data (JSON-LD) for AEO.
        defineArrayMember({
          name: 'faq',
          title: 'FAQ',
          type: 'object',
          fields: [
            defineField({
              name: 'question',
              title: 'Question',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'answer',
              title: 'Answer',
              type: 'text',
              rows: 4,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'question' },
            prepare: ({ title }) => ({ title: title || 'FAQ', subtitle: 'FAQ' }),
          },
        }),
        // Table (docs/DECISIONS.md 30): a custom object, not a plugin, because it
        // must render as semantic <table><thead><th> markup. A real table is
        // extractable by AI systems and credited by our own engine; a grid of divs
        // that merely looks like a table is neither. Cells are plain text.
        defineArrayMember({
          name: 'table',
          title: 'Table',
          type: 'object',
          fields: [
            defineField({
              name: 'caption',
              title: 'Caption',
              type: 'string',
              description: 'Optional. Says what the table compares; rendered as <caption>.',
            }),
            defineField({
              name: 'header',
              title: 'Header row',
              type: 'array',
              of: [{ type: 'string' }],
              validation: (rule) => rule.required().min(2),
            }),
            defineField({
              name: 'rows',
              title: 'Rows',
              type: 'array',
              of: [
                defineArrayMember({
                  name: 'tableRow',
                  title: 'Row',
                  type: 'object',
                  fields: [defineField({ name: 'cells', title: 'Cells', type: 'array', of: [{ type: 'string' }] })],
                  preview: {
                    select: { cells: 'cells' },
                    prepare: ({ cells }) => ({ title: ((cells as string[] | undefined) ?? []).join(' | ') || 'Empty row' }),
                  },
                }),
              ],
              validation: (rule) =>
                rule.required().min(1).custom((rows, context) => {
                  const width = ((context.parent as { header?: string[] })?.header ?? []).length
                  const bad = ((rows ?? []) as { cells?: string[] }[]).findIndex((r) => (r.cells ?? []).length !== width)
                  return bad === -1 ? true : `Row ${bad + 1} has a different number of cells from the header row (${width}).`
                }),
            }),
          ],
          preview: {
            select: { header: 'header', caption: 'caption' },
            prepare: ({ header, caption }) => ({
              title: caption || ((header as string[] | undefined) ?? []).join(' | ') || 'Table',
              subtitle: 'Table',
            }),
          },
        }),
      ],
    }),
    defineField({
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      group: 'seo',
      description: 'Optional override for the <title> tag.',
    }),
    defineField({
      name: 'seoDescription',
      title: 'SEO description',
      type: 'text',
      rows: 3,
      group: 'seo',
      description: 'Optional override for the meta description.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      author: 'author.name',
      media: 'mainImage',
    },
    prepare: ({ title, author, media }) => ({
      title,
      subtitle: author ? `by ${author}` : undefined,
      media,
    }),
  },
})
