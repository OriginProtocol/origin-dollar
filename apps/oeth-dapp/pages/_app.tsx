import seoConfig from '../src/seo';
import { DefaultSeo } from 'next-seo';
import '../src/styles/global.scss';

function MyApp({ Component, pageProps, router }) {
  const url = `${seoConfig.baseURL}${router.route}`;
  return (
    <>
      <DefaultSeo
        defaultTitle={seoConfig.defaultTitle}
        titleTemplate={`%s | ${seoConfig.defaultTitle}`}
        description={seoConfig.description}
        openGraph={seoConfig.openGraph({ url })}
        twitter={seoConfig.twitter}
      />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
