import { ErrorBoundary, Link } from '@originprotocol/ui';
import { useTranslation } from 'next-i18next';
import { getStaticPaths, makeStaticProps } from '../../lib/getStatic';

const FourOhFour = () => {
  const { t } = useTranslation(['404', 'common']);
  return (
    <ErrorBoundary>
      <div className="flex flex-col items-center justify-center space-y-8 py-10">
        <h1 className="font-header text-6xl font-bold">{t('title')}</h1>
        <p className="text-lg">{t('description')}</p>
        <Link href="/">
          <button type="button">{t('back')}</button>
        </Link>
      </div>
    </ErrorBoundary>
  );
};

export default FourOhFour;

const getStaticProps = makeStaticProps(['404', 'common']);

export { getStaticPaths, getStaticProps };
