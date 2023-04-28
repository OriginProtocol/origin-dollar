import type { Namespace } from 'i18next';
import type { SSRConfig, UserConfig } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import i18nextConfig from '../next-i18next.config';

type ArrayElementOrSelf<T> = T extends Array<infer U> ? U[] : T[];

export const getI18nPaths = () =>
  i18nextConfig.i18n.locales.map((lng) => ({
    params: {
      locale: lng,
    },
  }));

export const getStaticPaths = () => ({
  fallback: false,
  paths: getI18nPaths(),
});

export const i18n = async (
  locale: string,
  namespacesRequired?: ArrayElementOrSelf<Namespace> | undefined,
  configOverride?: UserConfig,
  extraLocales?: string[] | false
): Promise<SSRConfig> => {
  const config = configOverride ?? i18nextConfig;
  return serverSideTranslations(
    locale,
    namespacesRequired,
    config,
    extraLocales
  );
};

export async function getI18nProps(ctx, ns = ['common']) {
  const locale = ctx?.params?.locale;
  return {
    ...(await i18n(locale, ns)),
  };
}

export function makeStaticProps(ns = {}) {
  return async function getStaticProps(ctx) {
    return {
      // @ts-ignore
      props: await getI18nProps(ctx, ns),
    };
  };
}
