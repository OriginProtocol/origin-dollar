import { ReactNode } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';

type LinkProps = {
  children: ReactNode;
  href: string;
  style?: any;
  className?: string;
  skipLocaleHandling?: boolean;
  locale?: string;
};

const Link = ({ children, skipLocaleHandling, ...rest }: LinkProps) => {
  const router = useRouter();
  const locale = rest.locale || router.query['locale'] || '';

  let href = rest.href || router.asPath;

  if (href.indexOf('http') === 0) skipLocaleHandling = true;

  if (locale && !skipLocaleHandling) {
    href = href
      ? `/${locale}${href}`
      : // @ts-ignore
        router.pathname.replace('[locale]', locale);
  }

  console.log({
    href,
    locale,
  });

  return (
    <NextLink {...rest} href={href}>
      {children}
    </NextLink>
  );
};

export default Link;
