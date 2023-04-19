import { useMemo, useEffect, useState, useContext } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import cx from "classnames";
import { capitalize } from "lodash";
import { Typography } from "@originprotocol/origin-storybook";
import { AnimatePresence, motion, useCycle } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import Button from "../Button";
import { fetchAPI } from "../../../lib/api";
import transformLinks from "../../utils/transformLinks";
import { useRouter } from "next/router";
import { NavigationContext } from "../../../pages/_app";

const RealTimeStats = dynamic(() => import("../RealTimeStats"), {
  ssr: false,
});

const partsToHref = (parts, index) => `/${parts.slice(0, index).join("/")}`;

const partToLabel = (part) => capitalize(part?.replace(/-/g, " "));

const noop = () => {};

const NavigationSidebar = ({
  pathname,
  linkHeight = 52,
  navLinks,
  onClickLink,
}) => (
  <div className="flex flex-col h-full mt-6 md:mt-10">
    <nav className="flex flex-col h-full w-full">
      <div className="list-unstyled space-y-1">
        {navLinks?.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center w-full rounded-md px-4 -ml-4 hover:bg-origin-bg-grey hover:text-origin-white duration-300",
              {
                "bg-origin-bg-grey text-origin-white": href === pathname,
                "text-subheading": href !== pathname,
              }
            )}
            style={{ height: linkHeight }}
            onClick={onClickLink}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  </div>
);

const Breadcrumbs = ({ pathname }) => {
  const parts: string[] = useMemo(() => {
    if (pathname === "/analytics") {
      return ["analytics", "overview"];
    }
    return pathname?.replace("/", "").split("/");
  }, [pathname]);

  return (
    <ol className="flex flex-row items-center space-x-2 font-header text-xl">
      {parts.map((part, index) => {
        const isLast = index === parts?.length - 1;
        const href = partsToHref(parts, index - 1);
        const label = partToLabel(part);
        return isLast ? (
          <span key={part} className="flex flex-row space-x-2 font-light">
            <span>/</span>
            <span>{label}</span>
          </span>
        ) : (
          <Link
            key={part}
            href={href}
            className="text-subheading hover:text-origin-white duration-300"
          >
            {label}
          </Link>
        );
      })}
    </ol>
  );
};

const MainNavigation = ({ links, onClickLink = noop }) => {
  return (
    <nav className="flex flex-col w-full">
      <div className="list-unstyled space-y-6">
        {links?.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center w-full px-4 -ml-4 text-subheading"
            onClick={onClickLink}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
};

const NavigationDivider = () => (
  <div className="relative flex w-full h-[1px] bg-origin-bg-grey my-10" />
);

const AnalyticsNavigation = ({
  links,
  currentPathname,
  onClickLink = noop,
}) => (
  <div className="flex flex-col w-full h-full">
    <NavigationSidebar
      linkHeight={52}
      navLinks={links}
      pathname={currentPathname}
      onClickLink={onClickLink}
    />
    <a
      className="mt-8"
      href="https://www.ousd.com/ogv-dashboard"
      target="_blank"
      rel="noreferrer"
    >
      <Button
        buttonSize="sm"
        append={
          <Image
            src="/images/ext-link-white.svg"
            height={12}
            width={12}
            alt="External link icon"
          />
        }
      >
        <Typography.Body2>Get OUSD</Typography.Body2>
      </Button>
    </a>
  </div>
);

const MobileNavigation = ({ links, subLinks, currentPathname }) => {
  const [isMenuOpen, cycleOpen] = useCycle(false, true);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [isMenuOpen]);

  const handlers = useSwipeable({
    onSwipedLeft: () => cycleOpen(),
  });

  return (
    <>
      <div className="flex flex-row md:hidden flex-shrink-0 items-center justify-between pt-8 pr-4 pl-6 z-[3]">
        {isMenuOpen ? (
          <div />
        ) : (
          <Link href="/">
            <Image
              src="/images/origin-dollar-logo.svg"
              height={24}
              width={190}
              alt="Origin dollar logo"
            />
          </Link>
        )}
        <button onClick={() => cycleOpen()}>
          <Image src="/images/menu.svg" height={34} width={56} alt="menu" />
        </button>
      </div>
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <div
              className="md:hidden absolute top-0 left-0 w-full min-h-[100vh] bg-black bg-opacity-25 z-[1]"
              role="button"
              onClick={() => cycleOpen()}
            />
            <motion.aside
              className="flex md:hidden absolute top-0 left-0 min-h-[100vh] bg-origin-bg-black z-[2] shadow-xs shadow-sidebar"
              initial={{ width: 0 }}
              animate={{
                width: 300,
                transition: { duration: 0.3 },
              }}
              exit={{
                width: 0,
                transition: { duration: 0.2 },
              }}
              {...handlers}
            >
              <motion.div
                className="flex flex-col h-full w-full bg-dark pt-8"
                initial="closed"
                animate="open"
                exit="closed"
                variants={{
                  closed: {
                    opacity: 0,
                  },
                  open: {
                    opacity: 1,
                    transition: {
                      duration: 0.4,
                    },
                  },
                }}
              >
                <div className="flex flex-col h-full w-full pl-8 ">
                  <RealTimeStats />
                  <AnalyticsNavigation
                    links={links}
                    currentPathname={currentPathname}
                    onClickLink={() => {
                      cycleOpen();
                    }}
                  />
                </div>
                <NavigationDivider />
                <div className="flex flex-col w-full pl-8 py-10">
                  <MainNavigation
                    links={subLinks}
                    onClickLink={() => {
                      cycleOpen();
                    }}
                  />
                </div>
              </motion.div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

const DesktopSidebarNavigation = ({
  links,
  subLinks,
  sidebarWidth,
  currentPathname,
}) => {
  return (
    <div
      className="hidden md:flex flex-shrink-0 flex-col min-h-[100vh] border-r-[2px] border-origin-bg-grey"
      style={{ width: sidebarWidth }}
    >
      <div className="flex flex-col w-full py-10 pl-12 pr-4">
        <Link href="/">
          <Image
            src="/images/origin-dollar-logo.svg"
            height={24}
            width={190}
            alt="Origin dollar logo"
          />
        </Link>
        <AnalyticsNavigation links={links} currentPathname={currentPathname} />
        <NavigationDivider />
        <MainNavigation links={subLinks} />
      </div>
    </div>
  );
};

const TwoColumnLayout = ({ sidebarWidth = 316, children }) => {
  const { links } = useContext(NavigationContext);
  const { pathname } = useRouter();

  const analyticsLinks = [
    {
      label: "Overview",
      href: "/analytics",
      enabled: true,
    },
    {
      label: "Collateral",
      href: "/analytics/collateral",
      enabled: true,
    },
    {
      label: "Supply",
      href: "/analytics/supply",
      enabled: false,
    },
    {
      label: "Holders",
      href: "/analytics/holders",
      enabled: false,
    },
    {
      label: "Protocol revenue",
      href: "/analytics/protocol-revenue",
      enabled: true,
    },
    {
      label: "Strategies",
      href: "/analytics/strategies",
      enabled: true,
    },
    {
      label: "Dripper",
      href: "/analytics/dripper",
      enabled: false,
    },
    {
      label: "Health monitoring",
      href: "/analytics/health-monitoring",
      enabled: true,
    },
  ].filter((link) => link.enabled);

  return (
    <>
      <div className="flex flex-col md:flex-row w-full h-full">
        <MobileNavigation
          currentPathname={pathname}
          links={analyticsLinks}
          subLinks={links}
        />
        <DesktopSidebarNavigation
          sidebarWidth={sidebarWidth}
          currentPathname={pathname}
          links={analyticsLinks}
          subLinks={links}
        />
        <div className="flex flex-col w-full h-full px-6 md:px-8 py-8 space-y-4 md:space-y-10">
          <div className="flex flex-row items-center justify-between w-full">
            <Breadcrumbs pathname={pathname} />
            <div className="hidden md:flex flex-shrink-0 w-[300px]">
              <RealTimeStats />
            </div>
          </div>
          {children}
        </div>
      </div>
    </>
  );
};

export default TwoColumnLayout;
