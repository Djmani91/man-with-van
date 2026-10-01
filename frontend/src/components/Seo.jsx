import { Helmet } from "react-helmet-async";

export const Seo = ({ title, description, path = "/", noindex = false, keywords, jsonLd }) => {
  const base = process.env.REACT_APP_SITE_URL || process.env.REACT_APP_BACKEND_URL || "";
  const url = base + path;
  const blocks = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(b)}</script>
      ))}
    </Helmet>
  );
};
