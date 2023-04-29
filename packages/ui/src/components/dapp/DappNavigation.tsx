import { useRouter } from 'next/router';
import cx from 'classnames';
import Link from '../core/Link';

type DappLink = {
  href: string;
  label: string;
};

type DappNavigationProps = {
  links: DappLink[];
};

const DappNavigation = ({ links }: DappNavigationProps) => {
  const router = useRouter();
  const pathWithoutLocale = router?.pathname?.replace('/[locale]', '');
  return (
    <nav className="flex flex-row items-center h-full">
      <ul className="grid grid-cols-3 gap-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
        {links.map(({ href, label }) => {
          const isActiveLink = (pathWithoutLocale || '/') === href;
          return (
            <li
              key={href}
              className="flex justify-center items-center h-full w-full"
            >
              <Link
                href={href}
                className={cx(
                  'relative flex items-center px-5 lg:px-6 justify-center w-full h-full rounded-full overflow-hidden',
                  {
                    'text-origin-dimmed': !isActiveLink,
                    'text-origin-white': isActiveLink,
                  }
                )}
                style={
                  isActiveLink
                    ? {
                        background:
                          'linear-gradient(#1E1F25, #1E1F25) padding-box,linear-gradient(to right, #B361E6 20%, #6A36FC 80%) border-box',
                        borderRadius: '50em',
                        border: '1px solid transparent',
                        borderImage:
                          'linear-gradient(90deg, #B361E6, #6A36FC) 1',
                      }
                    : {}
                }
              >
                <div
                  className={cx({
                    'absolute top-0 left-0 w-full h-full z-[1] rounded-full bg-gradient-to-r from-gradient1-from/10 to-gradient1-to/10':
                      isActiveLink,
                  })}
                />
                <span className="text-sm">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DappNavigation;
