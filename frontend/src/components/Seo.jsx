import { Helmet } from "react-helmet-async";

export const Seo = ({ title, description, path = "/", noindex = false }) => {
  const base = process.env.REACT_APP_BACKEND_URL || "";
  const url = base + path;
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
    </Helmet>
  );
};
