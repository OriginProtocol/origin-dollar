import type { Namespace } from 'i18next';
import type { SSRConfig, UserConfig } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import nextI18nextConfig from '../../next-i18next.config';

type ArrayElementOrSelf<T> = T extends Array<infer U> ? U[] : T[];

export default async (
  locale: string,
  namespacesRequired?: ArrayElementOrSelf<Namespace> | undefined,
  configOverride?: UserConfig,
  extraLocales?: string[] | false
): Promise<SSRConfig> => {
  const config = configOverride ?? nextI18nextConfig;
  return serverSideTranslations(
    locale,
    namespacesRequired,
    config,
    extraLocales
  );
};
