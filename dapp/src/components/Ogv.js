import React, { useEffect } from 'react'
import { fbt } from 'fbt-runtime'
import { Typography } from '@originprotocol/origin-storybook'
import { assetRootPath } from 'utils/image'
import { useStoreState } from 'pullstate'
import useCirculatingSupplyQuery from '../queries/useCirculatingSupplyQuery'
import usePriceQuery from '../queries/usePriceQuery'
import useTotalSupplyQuery from '../queries/useTotalSupplyQuery'
import ContractStore from 'stores/ContractStore'
import { formatCurrency } from 'utils/math'

const Ogv = () => {
  const price = useStoreState(ContractStore, (s) => {
    return s.ogv.price || 0
  })

  const circulatingSupply = useStoreState(ContractStore, (s) => {
    return s.ogv.circulating || 0
  })

  const totalSupply = useStoreState(ContractStore, (s) => {
    return s.ogv.total || 0
  })

  const priceQuery = usePriceQuery({
    onSuccess: (price) => {
      ContractStore.update((s) => {
        s.ogv.price = price['origin-dollar-governance'].usd
      })
    },
  })

  const circulatingSupplyQuery = useCirculatingSupplyQuery({
    onSuccess: (circulatingSupply) => {
      ContractStore.update((s) => {
        s.ogv.circulating = circulatingSupply
      })
    },
  })

  const totalSupplyQuery = useTotalSupplyQuery({
    onSuccess: (totalSupply) => {
      ContractStore.update((s) => {
        s.ogv.total = totalSupply
      })
    },
  })

  useEffect(() => {
    priceQuery.refetch()
    circulatingSupplyQuery.refetch()
    totalSupplyQuery.refetch()
  }, [price, circulatingSupply, totalSupply])

  //move elsewhere
  const Huobi = () => {
    return (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="110"
          height="32"
          className="fill-white"
        >
          <path
            fill="url(#a)"
            d="M14.554 10.4c-.4 4.527-4.922 8.623-6.451 11.21-1.466 2.48-1.976 4.825-.904 9.354.057.24-.184.45-.408.347C4.875 30.431 0 27.794 0 21.507c0-8.87 9.81-9.186 9.35-21.19-.01-.241.254-.405.452-.266 3.21 2.26 5.134 6.034 4.752 10.349Z"
          />
          <path
            fill="url(#b)"
            d="M8.155 31.67a.284.284 0 0 1-.2-.26c-.112-2.943 1.471-4.866 3.246-6.292 3.94-3.166 6.37-7.442 5.408-12.39-.057-.295.288-.49.482-.26.926 1.106 1.87 2.603 2.393 3.695 2.52 5.413 1.175 11.617-4.855 14.748-1.888.937-4.13 1.475-6.474.759Z"
          />
          <path
            fill="url(#c)"
            fillRule="evenodd"
            d="M40.34 8.047v9.348h-8.975V9.25c0-.665-.524-1.203-1.17-1.203h-3.03v22.277c0 .664.525 1.202 1.172 1.202h3.028v-10.36h8.974v9.158c0 .664.524 1.202 1.17 1.202h3.03V9.25c0-.665-.525-1.203-1.171-1.203h-3.029Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#d)"
            fillRule="evenodd"
            d="M58.313 13.575v11.139c0 1.012-.512 1.972-1.381 2.478-2.427 1.413-4.937-.352-4.937-2.68v-9.733a1.2 1.2 0 0 0-1.195-1.204h-3.102v11.334c0 3.647 2.96 6.63 6.576 6.63h1.76c3.617 0 6.576-2.983 6.576-6.63v-10.13a1.2 1.2 0 0 0-1.194-1.204h-3.103Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#e)"
            fillRule="evenodd"
            d="M105.991 31.526h3.038V15.728c0-.667-.526-1.206-1.174-1.206h-3.038V30.32c0 .666.526 1.206 1.174 1.206Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#f)"
            fillRule="evenodd"
            d="M106.949 12.732a2.343 2.343 0 1 0-.001-4.685 2.343 2.343 0 0 0 .001 4.685Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#g)"
            fillRule="evenodd"
            d="M77.697 24.078c0 2.14-1.726 3.564-3.835 3.564s-3.834-1.424-3.834-3.564v-3.055c0-2.14 1.725-3.565 3.834-3.565 2.11 0 3.835 1.425 3.835 3.565v3.055Zm-3.835-10.503c-4.459 0-8.107 3.236-8.107 7.761v2.448c0 4.525 3.648 7.742 8.107 7.742 4.46 0 8.107-3.217 8.107-7.742v-2.448c0-4.525-3.648-7.761-8.107-7.761Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#h)"
            fillRule="evenodd"
            d="M97.144 24.083c0 2.138-1.737 3.562-3.859 3.562-2.123 0-3.86-1.424-3.86-3.562V21.03c0-2.138 1.737-3.562 3.86-3.562 2.123 0 3.86 1.424 3.86 3.562v3.053Zm-3.859-10.496a8.73 8.73 0 0 0-3.882.888V9.248c0-.663-.534-1.201-1.192-1.201h-3.086v15.742c0 4.522 3.672 7.737 8.16 7.737 4.488 0 8.16-3.215 8.16-7.737v-2.446c0-4.522-3.672-7.756-8.16-7.756Z"
            clipRule="evenodd"
          />
          <defs>
            <linearGradient
              id="a"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="b"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="c"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="d"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="e"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="f"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="g"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="h"
              x1="-4.968"
              x2="133.633"
              y1="18.701"
              y2="28.296"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
          </defs>
        </svg>
        <style jsx>{`
          svg:not(:hover) path {
            fill: white;
          }
        `}</style>
      </>
    )
  }

  const Uniswap = () => {
    return (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="36"
          height="41"
          fill="none"
        >
          <path
            fill="url(#a)"
            d="M13.914 10.082c-.433-.062-.454-.083-.248-.104.393-.061 1.3.021 1.94.166 1.487.35 2.828 1.259 4.252 2.848l.372.433.536-.082c2.292-.372 4.644-.083 6.605.825.537.248 1.383.743 1.486.867.041.041.104.31.145.578.144.97.082 1.693-.227 2.25-.165.31-.165.392-.062.66.082.207.33.351.557.351.495 0 1.011-.784 1.26-1.878l.102-.433.186.206c1.053 1.176 1.878 2.807 2.002 3.963l.041.31-.185-.269c-.31-.475-.599-.784-.991-1.052-.702-.475-1.445-.62-3.406-.723-1.775-.103-2.786-.248-3.777-.578-1.692-.557-2.56-1.28-4.561-3.942-.888-1.176-1.445-1.816-2.002-2.353-1.218-1.177-2.436-1.796-4.025-2.043Z"
          />
          <path
            fill="url(#b)"
            d="M29.29 12.703c.042-.784.145-1.3.372-1.775.083-.186.165-.351.186-.351.02 0-.02.145-.083.31-.165.454-.185 1.093-.082 1.816.144.929.206 1.053 1.197 2.064.454.475.99 1.073 1.197 1.32l.351.455-.35-.33c-.434-.413-1.425-1.197-1.652-1.3-.145-.083-.165-.083-.268.02-.083.083-.104.206-.104.805-.02.929-.144 1.507-.454 2.105-.165.31-.186.248-.041-.103.103-.268.124-.392.124-1.28 0-1.795-.206-2.229-1.466-2.951-.31-.186-.846-.454-1.155-.599-.33-.144-.578-.268-.558-.268.042-.041 1.26.31 1.734.516.723.289.846.31.929.289.062-.062.103-.227.124-.743Z"
          />
          <path
            fill="url(#c)"
            d="M14.76 15.778c-.867-1.197-1.424-3.054-1.3-4.437l.041-.434.207.041c.371.063 1.011.31 1.32.496.826.495 1.198 1.176 1.549 2.869.103.495.247 1.073.31 1.259.102.31.494 1.032.825 1.486.227.33.082.495-.434.454-.784-.083-1.837-.805-2.518-1.734Z"
          />
          <path
            fill="url(#d)"
            d="M28.238 24.757c-4.087-1.652-5.531-3.076-5.531-5.49 0-.351.02-.64.02-.64.02 0 .165.123.351.268.826.66 1.755.95 4.335 1.32 1.506.228 2.373.393 3.157.661 2.498.826 4.046 2.518 4.417 4.81.103.66.042 1.919-.123 2.58-.145.515-.558 1.465-.661 1.485-.02 0-.062-.103-.062-.268-.041-.867-.475-1.692-1.197-2.332-.867-.743-1.982-1.3-4.706-2.394Z"
          />
          <path
            fill="url(#e)"
            d="M25.349 25.438a4.893 4.893 0 0 0-.207-.867l-.103-.31.186.227c.268.31.474.681.66 1.197.145.393.145.516.145 1.156 0 .62-.021.764-.145 1.115-.206.557-.454.95-.867 1.383-.743.763-1.713 1.176-3.096 1.362-.247.02-.95.082-1.568.124-1.548.082-2.58.247-3.51.578-.123.04-.247.082-.267.062-.042-.042.598-.413 1.114-.66.723-.352 1.466-.538 3.096-.826.805-.124 1.63-.29 1.837-.372 2.043-.64 3.055-2.23 2.725-4.17Z"
          />
          <path
            fill="url(#f)"
            d="M27.227 28.76c-.537-1.176-.66-2.29-.372-3.343.041-.103.083-.206.124-.206.041 0 .165.062.289.144.248.165.764.454 2.085 1.177 1.671.908 2.62 1.61 3.281 2.415.578.701.93 1.506 1.094 2.497.103.557.041 1.899-.103 2.456-.454 1.754-1.486 3.158-2.993 3.963a2.874 2.874 0 0 1-.433.206c-.02 0 .062-.206.186-.454.495-1.052.557-2.064.185-3.199-.227-.702-.701-1.548-1.65-2.972-1.136-1.651-1.404-2.085-1.693-2.683Z"
          />
          <path
            fill="url(#g)"
            d="M11.85 35.077c1.527-1.28 3.406-2.188 5.14-2.477.742-.124 1.98-.083 2.662.103 1.094.289 2.084.908 2.6 1.672.496.743.723 1.383.95 2.807.082.557.186 1.135.206 1.259.165.743.496 1.32.909 1.63.64.475 1.754.496 2.848.083.186-.062.35-.124.35-.103.042.041-.515.413-.887.598-.516.269-.929.351-1.486.351-.99 0-1.837-.516-2.518-1.548-.144-.206-.433-.805-.681-1.362-.723-1.672-1.094-2.167-1.94-2.725-.743-.474-1.693-.578-2.415-.227-.95.455-1.197 1.672-.537 2.415.269.31.764.558 1.177.62a1.26 1.26 0 0 0 1.424-1.26c0-.495-.186-.784-.681-1.01-.66-.29-1.383.04-1.362.68 0 .269.123.434.392.558.165.082.165.082.041.061-.599-.123-.743-.866-.268-1.341.578-.578 1.795-.33 2.208.475.165.33.186.99.041 1.403-.35.908-1.341 1.383-2.352 1.115-.682-.186-.97-.372-1.796-1.218-1.445-1.486-2.002-1.775-4.066-2.085l-.392-.062.433-.412Z"
          />
          <path
            fill="url(#h)"
            fillRule="evenodd"
            d="M.994 1.867c4.809 5.841 12.219 14.923 12.59 15.418.31.413.186.805-.33 1.094-.289.165-.888.33-1.177.33-.33 0-.722-.165-.99-.433-.186-.186-.991-1.363-2.807-4.19a267.432 267.432 0 0 0-2.58-3.984c-.083-.041-.083-.041 2.435 4.458 1.59 2.828 2.106 3.84 2.106 3.963 0 .269-.083.413-.413.785-.558.619-.805 1.32-.991 2.786-.206 1.63-.764 2.786-2.353 4.747-.929 1.156-1.073 1.362-1.3 1.837-.29.578-.372.908-.413 1.651-.041.785.041 1.28.268 2.023.207.66.434 1.094.991 1.94.475.743.764 1.3.764 1.507 0 .165.04.165.784 0 1.775-.413 3.24-1.115 4.045-1.981.496-.537.62-.826.62-1.57 0-.474-.021-.577-.145-.866-.206-.454-.599-.826-1.445-1.404-1.114-.763-1.589-1.382-1.713-2.208-.103-.702.02-1.177.64-2.477.64-1.341.805-1.899.908-3.26.062-.868.165-1.219.413-1.487.268-.289.495-.392 1.135-.475 1.053-.144 1.734-.413 2.27-.929.475-.433.682-.866.702-1.506l.02-.475-.267-.289C13.79 15.758.354.98.292.98c-.02 0 .31.393.702.888Zm6.336 29.35a.852.852 0 0 0-.268-1.135c-.35-.227-.888-.124-.888.185 0 .083.042.166.166.207.185.103.206.206.061.433-.144.227-.144.434.042.578.289.227.68.103.887-.268Z"
            clipRule="evenodd"
          />
          <path
            fill="url(#i)"
            fillRule="evenodd"
            d="M15.69 20.36c-.496.145-.971.681-1.115 1.218-.083.33-.042.929.103 1.115.227.289.433.371 1.011.371 1.135 0 2.105-.495 2.209-1.094.103-.495-.33-1.176-.93-1.486-.309-.165-.949-.227-1.279-.124Zm1.32 1.032c.165-.247.103-.516-.206-.701-.558-.351-1.404-.062-1.404.474 0 .269.434.558.846.558.269 0 .64-.166.764-.33Z"
            clipRule="evenodd"
          />
          <defs>
            <linearGradient
              id="a"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="b"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="c"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="d"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="e"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="f"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="g"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="h"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="i"
              x1="-1.288"
              x2="42.974"
              y1="24.368"
              y2="25.147"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
          </defs>
        </svg>
        <style jsx>{`
          svg:not(:hover) path {
            fill: white;
          }
        `}</style>
      </>
    )
  }

  const Kucoin = () => {
    return (
      <>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="172"
          height="64"
          fill="none"
        >
          <path
            fill="url(#a)"
            d="M124.992 31.985c0-.816 0-1.584-.027-2.293a13.903 13.903 0 0 0-.198-1.994 6.689 6.689 0 0 0-.559-1.738 5.61 5.61 0 0 0-1.104-1.53 7.055 7.055 0 0 0-2.243-1.546 7.35 7.35 0 0 0-2.865-.537 7.455 7.455 0 0 0-2.877.537 6.989 6.989 0 0 0-2.256 1.539 5.567 5.567 0 0 0-1.1 1.53 6.67 6.67 0 0 0-.55 1.737 13.9 13.9 0 0 0-.191 1.995 76.021 76.021 0 0 0-.022 2.293c.004.816 0 1.578.022 2.291a13.9 13.9 0 0 0 .191 1.995 6.67 6.67 0 0 0 .55 1.738c.278.568.65 1.085 1.1 1.53a6.91 6.91 0 0 0 2.256 1.535c.913.37 1.891.554 2.877.54a7.297 7.297 0 0 0 2.865-.54 6.982 6.982 0 0 0 2.243-1.535 5.673 5.673 0 0 0 1.104-1.53 6.686 6.686 0 0 0 .559-1.738c.113-.657.178-1.322.196-1.989a59.99 59.99 0 0 0 .026-2.291l.003.001Zm-3.699 0c0 .904-.013 1.658-.044 2.257-.018.491-.067.982-.147 1.467a3.612 3.612 0 0 1-.294.935c-.113.24-.261.46-.44.657a2.842 2.842 0 0 1-1.001.733 3.425 3.425 0 0 1-1.367.276 3.484 3.484 0 0 1-1.374-.276 2.847 2.847 0 0 1-1.027-.733 2.593 2.593 0 0 1-.441-.657 3.548 3.548 0 0 1-.278-.935 12.044 12.044 0 0 1-.147-1.468 51.812 51.812 0 0 1-.04-2.256c0-.904.013-1.658.04-2.257.019-.492.068-.982.147-1.468.049-.323.143-.638.278-.935.113-.24.262-.461.441-.656a2.876 2.876 0 0 1 1.027-.734c.434-.187.902-.28 1.374-.276.47-.005.936.089 1.367.276.383.168.725.419 1.001.734.178.196.327.417.44.656.14.297.239.611.294.935.08.485.129.976.147 1.468.032.597.044 1.352.044 2.257Z"
          />
          <path
            fill="url(#b)"
            d="M154.467 22.837a.327.327 0 0 0-.324-.324h-3.052a.325.325 0 0 0-.324.324v11.274l-7.443-11.507c-.05-.078-.094-.091-.204-.091h-2.83a.328.328 0 0 0-.324.324V41.13a.327.327 0 0 0 .324.323h3.05a.323.323 0 0 0 .323-.323V29.827l7.444 11.534c.051.078.093.09.204.09h2.829a.325.325 0 0 0 .324-.322l.003-18.292Z"
          />
          <path
            fill="url(#c)"
            d="M134.011 22.837a.326.326 0 0 0-.325-.324h-3.049a.326.326 0 0 0-.324.324V41.13a.326.326 0 0 0 .324.324h3.049a.326.326 0 0 0 .325-.324V22.837Z"
          />
          <path
            fill="url(#d)"
            d="M97.513 31.985c0-.91.01-1.667.037-2.27.018-.492.067-.983.147-1.468.281-1.63 1.529-2.591 3.122-2.591 1.039.009 1.981.393 2.583 1.268.273.409.471.862.587 1.339.009.05.055.085.106.08h3.589c.051 0 .07-.035.062-.085-.392-2.22-1.577-4.215-3.67-5.203a7.545 7.545 0 0 0-3.285-.698c-2.021 0-3.723.692-5.107 2.076a5.48 5.48 0 0 0-1.547 2.842c-.212 1.065-.318 2.634-.32 4.709-.002 2.075.105 3.644.32 4.707a5.489 5.489 0 0 0 1.543 2.848c1.382 1.383 3.085 2.074 5.106 2.074a7.567 7.567 0 0 0 3.286-.696c2.093-.988 3.277-2.982 3.669-5.203.009-.052-.01-.085-.061-.085h-3.591a.098.098 0 0 0-.106.08c-.116.477-.314.93-.587 1.338-.602.88-1.544 1.26-2.583 1.268-1.593 0-2.84-.96-3.122-2.59a11.71 11.71 0 0 1-.147-1.467c-.02-.607-.031-1.366-.031-2.273Z"
          />
          <path
            fill="url(#e)"
            d="M59.606 22.837a.326.326 0 0 0-.324-.324h-3.049a.326.326 0 0 0-.324.324V41.13a.326.326 0 0 0 .324.323h3.049a.326.326 0 0 0 .324-.323v-5.37l2.447-2.925 5.026 8.521c.039.063.109.1.182.097h3.705c.17 0 .201-.106.116-.25l-6.58-11.157 6.037-7.242c.122-.147.07-.287-.12-.287h-4.05a.147.147 0 0 0-.126.06l-6.637 7.958v-7.698Z"
          />
          <path
            fill="url(#f)"
            d="M81.818 38.315c-1.716 0-3.272-1.588-3.272-3.485V22.837a.326.326 0 0 0-.324-.324h-3.049a.326.326 0 0 0-.324.324v11.946c0 4.176 3.123 6.83 6.97 6.83 3.845 0 6.969-2.654 6.969-6.83V22.837a.327.327 0 0 0-.325-.324h-3.05a.326.326 0 0 0-.323.324V34.83c0 1.895-1.557 3.485-3.272 3.485Z"
          />
          <path
            fill="url(#g)"
            fillRule="evenodd"
            d="m25.262 31.985 9.465 9.467 5.974-5.975a2.702 2.702 0 0 1 3.817 3.817l-7.884 7.886a2.722 2.722 0 0 1-3.817 0L21.442 35.801v6.762a2.702 2.702 0 1 1-5.404 0V21.397a2.702 2.702 0 1 1 5.404 0v6.763l11.374-11.375a2.72 2.72 0 0 1 3.816 0l7.89 7.884a2.702 2.702 0 0 1-3.816 3.817l-5.975-5.974-9.469 9.473Zm9.47-2.705a2.705 2.705 0 1 0-.004 5.414 2.705 2.705 0 0 0 .003-5.416v.002Z"
            clipRule="evenodd"
          />
          <defs>
            <linearGradient
              id="a"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="b"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="c"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="d"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="e"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="f"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
            <linearGradient
              id="g"
              x1="-7.754"
              x2="210.048"
              y1="37.403"
              y2="49.228"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#FEDBA8" />
              <stop offset=".878" stopColor="#CF75D5" />
            </linearGradient>
          </defs>
        </svg>
        <style jsx>{`
          svg:not(:hover) path {
            fill: white;
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      <section className="gradient3 relative z-0">
        <div className="relative divide-black divide-y-2">
          <div>
            <div className="flex flex-col lg:flex-row overflow-hidden max-w-screen-2xl mx-auto px-[32px] py-[56px] lg:py-[120px] lg:pl-[134px] lg:pr-[208px] text-center lg:text-left">
              <div className="lg:w-2/3">
                <Typography.H2
                  className="text-[32px] md:text-[72px] lg:text-left"
                  style={{ fontWeight: 700 }}
                >
                  {fbt('Governed by OGV stakers', 'Governed by OGV stakers')}
                </Typography.H2>
                <Typography.Body3 className="mt-[16px] lg:text-left">
                  {fbt(
                    "OUSD's future is shaped by voters who lock their OGV and participate in decentralized governance.",
                    "OUSD's future is shaped by voters who lock their OGV and participate in decentralized governance."
                  )}
                </Typography.Body3>
                <img
                  src={assetRootPath(`/images/ogv.svg`)}
                  className="mt-8 lg:mt-8 mx-auto block lg:hidden"
                />
                <div className="flex flex-col justify-between w-full my-16 lg:w-4/5 text-left font-weight-bold">
                  <div className="flex flex-row justify-between">
                    <div className="w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold">
                        {'OGV PRICE'}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold">{`$${formatCurrency(
                        price,
                        4
                      )}`}</Typography.H5>
                    </div>
                    <div className="w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold">
                        {'OGV MARKET CAP'}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold">{`$${formatCurrency(
                        circulatingSupply * price,
                        0
                      )}`}</Typography.H5>
                    </div>
                  </div>
                  <div className="flex flex-row justify-between mt-10">
                    <div className="w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold">
                        {'CIRCULATING SUPPLY'}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold">
                        {formatCurrency(circulatingSupply, 0)}
                      </Typography.H5>
                    </div>
                    <div className="w-96">
                      <Typography.Body3 className="text-xs lg:text-base font-bold">
                        {'TOTAL SUPPLY'}
                      </Typography.Body3>
                      <Typography.H5 className="mt-[4px] font-bold">
                        {formatCurrency(totalSupply, 0)}
                      </Typography.H5>
                    </div>
                  </div>
                </div>
                <span className="hidden lg:block w-1/5">
                  <a
                    href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bttn bg-black ml-0"
                  >
                    <Typography.H7 className="font-normal">
                      {fbt('Buy OGV', 'Buy OGV')}
                    </Typography.H7>
                  </a>
                </span>
                {/*<span>
                <a
                  href="/ogv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn gradient2"
                >
                  <Typography.H7 className="font-normal">
                    {fbt('View dashboard', 'View dashboard')}
                  </Typography.H7>
                </a>
              </span>*/}
              </div>
              <div>
                <img
                  src={assetRootPath(`/images/ogv.svg`)}
                  className="hidden lg:block"
                />
                <Typography.Body3 className="mt-8 text-center text-white opacity-75">
                  {fbt(
                    'OGV is listed on top exchanges',
                    'OGV is listed on top exchanges'
                  )}
                </Typography.Body3>
                <div className="flex flex-row justify-between items-center mt-[12px] md:mx-32 lg:mx-0">
                  <a
                    href="https://www.huobi.com/en-in/exchange/ogv_usdt"
                    target="_blank"
                    rel="nofollow noreferrer"
                    className=""
                  >
                    <Huobi />
                  </a>
                  <a
                    href="https://app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"
                    target="_blank"
                    rel="nofollow noreferrer"
                    className='ml-[10px]'
                  >
                    <Uniswap />
                  </a>
                  <a
                    href="https://www.kucoin.com/trade/OGV-USDT"
                    target="_blank"
                    rel="nofollow noreferrer"
                    className="mt-[8px]"
                  >
                    <Kucoin />
                  </a>
                </div>
                <a
                  href='https://"app.uniswap.org/#/swap?outputCurrency=0x9c354503C38481a7A7a51629142963F98eCC12D0&chain=mainnet"'
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn bg-black block lg:hidden text-center mt-5"
                >
                  <Typography.H7 className="font-normal">
                    {fbt('Buy OGV', 'Buy OGV')}
                  </Typography.H7>
                </a>
              </div>
            </div>
          </div>
          <div>
            <div className="overflow-hidden max-w-screen-2xl mx-auto py-[120px] px-8 md:px-[134px] text-center">
              <div>
                <Typography.H2 className="font-normal">
                  {fbt('Stake OGV', 'Stake OGV')} <br className="block" />
                  <span className="text-gradient1 font-bold py-1">
                    {fbt('To Earn OGV', 'To Earn OGV')}
                  </span>
                </Typography.H2>
                <Typography.Body3 className="mt-[16px] mb-10 font-normal text-[#fafbfb]">
                  {fbt(
                    'Fees and voting rights accrue to OGV stakers. Control the future of OUSD',
                    'Fees and voting rights accrue to OGV stakers. Control the future of OUSD'
                  )}{' '}
                  <br className="hidden lg:block" />
                  {fbt(
                    'and profit from its growth.',
                    'and profit from its growth.'
                  )}
                </Typography.Body3>
                <a
                  href="https://governance.ousd.com/stake"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bttn bg-black"
                >
                  <Typography.H7 className="font-normal">
                    {fbt('Earn rewards', 'Earn rewards')}
                  </Typography.H7>
                </a>
              </div>
            </div>
          </div>
        </div>
        <img
          src={assetRootPath(`/images/splines21.png`)}
          className="absolute w-3/5 left-0 bottom-0 -z-10"
        />
      </section>
    </>
  )
}

export default Ogv
