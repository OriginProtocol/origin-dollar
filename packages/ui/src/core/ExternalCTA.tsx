import React from 'react';
import Image from 'next/image';
import { Typography } from '@originprotocol/origin-storybook';

const ExternalCTA = ({ description, externalHref, cta }) => (
  <div className="flex flex-col w-full items-start justify-center h-[140px] bg-origin-bg-lgrey rounded-xl px-10 space-y-4">
    <Typography.Body className="text-origin-dimmed">
      {description}
    </Typography.Body>
    <span className="inline-block">
      <a
        href={externalHref}
        target="_blank"
        rel="noreferrer"
        className="flex flex-row space-x-4 items-center justify-center h-[44px] px-6 bg-gradient-to-r from-gradient2-from to-gradient2-to rounded-full"
      >
        <span>{cta}</span>
        <Image
          src="/icons/external.png"
          height={8}
          width={8}
          alt={`Visit ${externalHref}`}
        />
      </a>
    </span>
  </div>
);

export default ExternalCTA;
