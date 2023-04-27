import { useRouter } from 'next/router';
import Link from 'next/link';
import { Typography } from '@originprotocol/origin-storybook';
import cx from 'classnames';

type DappLink = {
  href: string;
  label: string;
};

type DappNavigationProps = {
  links: DappLink[];
};

const DappNavigation = ({ links }: DappNavigationProps) => {
  const { pathname } = useRouter();
  return (
    <nav className="hidden lg:flex flex-row items-center h-full">
      <ul className="grid grid-cols-3 gap-4 h-[44px] bg-origin-bg-lgrey rounded-full overflow-hidden">
        {links.map(({ href, label }) => {
          const isActiveLink = pathname === href;
          return (
            <li
              key={href}
              className="flex justify-center items-center h-full w-full"
            >
              <Link
                href={href}
                className="relative flex items-center px-6 justify-center w-full h-full rounded-full overflow-hidden"
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
                <Typography.Caption>{label}</Typography.Caption>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default DappNavigation;
