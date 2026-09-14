import imageUrlBuilder from '@sanity/image-url'
import type { Image } from 'sanity'

import { dataset, projectId } from '../env'

const builder = imageUrlBuilder({ projectId, dataset })

// Build a URL for a Sanity image source. Usage: urlFor(image).width(800).url()
export function urlFor(source: Image) {
  return builder.image(source)
}
