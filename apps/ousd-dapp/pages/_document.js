import React from 'react'
import Document, { Html, Head, Main, NextScript } from 'next/document'
import { GTM_ID } from '../lib/gtm'

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <link
            rel="shortcut icon"
            href="/images/favicon.ico"
            type="image/x-icon"
          />
          <link rel="icon" href="/images/favicon.ico" type="image/x-icon" />
          <link
            href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@700&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap"
            rel="stylesheet"
          />
          {/* jQuery is required for bootstrap javascript */}
          <script
            src="https://code.jquery.com/jquery-3.6.0.slim.min.js"
            integrity="sha384-Qg00WFl9r0Xr6rUqNLv1ffTSSKEFFCDCKVyHZ+sVt8KuvG99nWw5RNvbhuKgif9z"
            crossOrigin="anonymous"
          />
          <script
            src="https://cdn.jsdelivr.net/npm/popper.js@1.16.0/dist/umd/popper.min.js"
            integrity="sha384-Q6E9RHvbIyZFJoft+2mJbHaEWldlvI9IOYy5n3zV9zzTtmI3UksdQRVvoxMfooAo"
            crossOrigin="anonymous"
          />
          <script
            src="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js"
            integrity="sha384-wfSDF2E50Y2D1uUdj0O3uMBJnjuUD4Ih7YwaYd1iqfktj0Uod8GCExl3Og8ifwB6"
            crossOrigin="anonymous"
          />
          <meta
            name="image"
            content={
              'https://cmsmediaproduction.s3.amazonaws.com/meta_9121c5630d.jpeg'
            }
          />
          <meta property="og:url" content="https://ousd.com" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Origin Dollar (OUSD)" />
          <meta
            property="og:description"
            content="A fully transparent stablecoin that earns a yield from DeFi"
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@originprotocol" />
          <meta name="twitter:title" content="Origin Dollar (OUSD)" />
          <meta
            name="twitter:description"
            content="A fully transparent stablecoin that earns a yield from DeFi"
          />
          {/* If not on localhost and request's protocl was HTTP, redirect to HTTPS */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
            var href = window.location.href;
            var isLocal = /^http:\\/\\/localhost(.*)$/.exec(href);
            var http = /^http:\\/\\/(.*)$/.exec(href);
            if (!isLocal && http) {
              window.location.replace('https://' + http[1]);
            }
          `,
            }}
          />
          <script
            id="gtag-base"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer', '${GTM_ID}');
              `,
            }}
          />
        </Head>
        <body>
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
