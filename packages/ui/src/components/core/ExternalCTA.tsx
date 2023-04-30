import Image from 'next/image';

type ExternalCTAProps = {
  description: string;
  externalHref: string;
  cta: string;
};

const ExternalCTA = ({ description, externalHref, cta }: ExternalCTAProps) => (
  <div className="flex flex-col w-full items-start justify-center h-[140px] bg-origin-bg-lgrey rounded-xl px-4 lg:px-10 space-y-4">
    <p className="text-sm">{description}</p>
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
