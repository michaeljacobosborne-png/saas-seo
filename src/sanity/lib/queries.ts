import { groq } from 'next-sanity'

// Card fields for the /blog list page. Ordered newest first.
export const postsListQuery = groq`
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    "slug": slug.current,
    excerpt,
    publishedAt,
    mainImage,
    "categories": categories[]->{ _id, title, "slug": slug.current }
  }
`

// All published slugs — used by generateStaticParams.
export const postSlugsQuery = groq`
  *[_type == "post" && defined(slug.current)]{ "slug": slug.current }
`

// Full article by slug, with author + categories resolved and body for reading
// time / rich text rendering.
export const postBySlugQuery = groq`
  *[_type == "post" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    excerpt,
    publishedAt,
    mainImage,
    body,
    seoTitle,
    seoDescription,
    "author": author->{
      _id,
      name,
      "slug": slug.current,
      image,
      bio
    },
    "categories": categories[]->{ _id, title, "slug": slug.current }
  }
`
