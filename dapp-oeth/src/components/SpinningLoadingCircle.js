import React from 'react'
import classnames from 'classnames'

export default function SpinningLoadingCircle({ backgroundColor = 'f2f3f5' }) {
  return (
    <>
      <div className="gradient-image" />
      <style jsx>{`
        .gradient-image {
          width: 24px;
          height: 24px;
          border-radius: 16.5px;
          border-style: solid;
          border-width: 2px;
          border-image-source: conic-gradient(
            from 0.25turn,
            #${backgroundColor},
            #00d592 0.99turn,
            #${backgroundColor}
          );
          border-image-slice: 1;
          background-image: linear-gradient(
              to bottom,
              #${backgroundColor},
              #${backgroundColor}
            ),
            conic-gradient(
              from 0.25turn,
              #${backgroundColor},
              #00d592 0.99turn,
              #${backgroundColor}
            );
          background-origin: border-box;
          background-clip: content-box, border-box;
          animation: rotate 2s linear infinite;
        }

        @-ms-keyframes rotate {
          from {
            -ms-transform: rotate(0deg);
          }
          to {
            -ms-transform: rotate(360deg);
          }
        }
        @-moz-keyframes rotate {
          from {
            -moz-transform: rotate(0deg);
          }
          to {
            -moz-transform: rotate(360deg);
          }
        }
        @-webkit-keyframes rotate {
          from {
            -webkit-transform: rotate(0deg);
          }
          to {
            -webkit-transform: rotate(360deg);
          }
        }
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 992px) {
        }
      `}</style>
    </>
  )
}
