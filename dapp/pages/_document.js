import React from 'react'
import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render() {
    const { FULLSTORY_ORG_ID } = process.env
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
          {/* Twitter ads tracking */}
          <script
            src="//static.ads-twitter.com/oct.js"
            type="text/javascript"
          ></script>

          <meta property="og:url" content="https://ousd.com" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Origin Dollar (OUSD)" />
          <meta
            property="og:description"
            content="The first stablecoin that earns a yield while it’s still in your wallet"
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:site" content="@originprotocol" />
          <meta name="twitter:title" content="Origin Dollar (OUSD)" />
          <meta
            name="twitter:description"
            content="The first stablecoin that earns a yield while it’s still in your wallet"
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
          {!FULLSTORY_ORG_ID ? null : (
            <script
              dangerouslySetInnerHTML={{
                __html: `
              window['_fs_debug'] = false;
              window['_fs_host'] = 'fullstory.com';
              window['_fs_script'] = 'edge.fullstory.com/s/fs.js';
              window['_fs_org'] = '${FULLSTORY_ORG_ID}';
              window['_fs_namespace'] = 'FS';
              (function(m,n,e,t,l,o,g,y){
                if (e in m) {if(m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].');} return;}
                g=m[e]=function(a,b,s){g.q?g.q.push([a,b,s]):g._api(a,b,s);};g.q=[];
                o=n.createElement(t);o.async=1;o.crossOrigin='anonymous';o.src='https://'+_fs_script;
                y=n.getElementsByTagName(t)[0];y.parentNode.insertBefore(o,y);
                g.identify=function(i,v,s){g(l,{uid:i},s);if(v)g(l,v,s)};g.setUserVars=function(v,s){g(l,v,s)};g.event=function(i,v,s){g('event',{n:i,p:v},s)};
                g.anonymize=function(){g.identify(!!0)};
                g.shutdown=function(){g("rec",!1)};g.restart=function(){g("rec",!0)};
                g.log = function(a,b){g("log",[a,b])};
                g.consent=function(a){g("consent",!arguments.length||a)};
                g.identifyAccount=function(i,v){o='account';v=v||{};v.acctId=i;g(o,v)};
                g.clearUserCookie=function(){};
                g._w={};y='XMLHttpRequest';g._w[y]=m[y];y='fetch';g._w[y]=m[y];
                if(m[y])m[y]=function(){return g._w[y].apply(this,arguments)};
                g._v="1.2.0";
              })(window,document,window['_fs_namespace'],'script','user');
            `,
              }}
            />
          )}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
