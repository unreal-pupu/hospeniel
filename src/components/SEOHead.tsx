/**
 * SEO Head Component
 * 
 * Renders structured data and meta tags for SEO
 * Can be used in client components to update metadata dynamically
 */

import Script from "next/script";
import { useEffect } from "react";

interface SEOHeadProps {
  structuredData?: object | object[];
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export default function SEOHead({
  structuredData,
  title,
  description,
  image,
  url,
}: SEOHeadProps) {
  useEffect(() => {
    // Update document title if provided
    if (title) {
      document.title = title;
    }

    // Update meta description if provided
    if (description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute("content", description);
      } else {
        const meta = document.createElement("meta");
        meta.name = "description";
        meta.content = description;
        document.getElementsByTagName("head")[0].appendChild(meta);
      }
    }

    // Update Open Graph tags if provided
    if (title) {
      updateMetaTag("property", "og:title", title);
    }
    if (description) {
      updateMetaTag("property", "og:description", description);
    }
    if (image) {
      updateMetaTag("property", "og:image", image);
    }
    if (url) {
      updateMetaTag("property", "og:url", url);
    }

    // Update Twitter Card tags if provided
    if (title) {
      updateMetaTag("name", "twitter:title", title);
    }
    if (description) {
      updateMetaTag("name", "twitter:description", description);
    }
    if (image) {
      updateMetaTag("name", "twitter:image", image);
    }
  }, [title, description, image, url]);

  const updateMetaTag = (attribute: string, name: string, content: string) => {
    const meta = document.querySelector(`meta[${attribute}="${name}"]`);
    if (meta) {
      meta.setAttribute("content", content);
    } else {
      const newMeta = document.createElement("meta");
      newMeta.setAttribute(attribute, name);
      newMeta.setAttribute("content", content);
      document.getElementsByTagName("head")[0].appendChild(newMeta);
    }
  };

  if (!structuredData) {
    return null;
  }

  const dataArray = Array.isArray(structuredData) ? structuredData : [structuredData];

  return (
    <>
      {dataArray.map((data, index) => (
        <Script
          key={index}
          id={`seo-structured-data-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}




