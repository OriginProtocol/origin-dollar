import React, { useState } from 'react'
import classnames from 'classnames'
import { fbt } from 'fbt-runtime'
import { toast } from 'react-toastify'
import analytics from 'utils/analytics'
import { assetRootPath } from 'utils/image'

const EmailForm = ({ footer }) => {
  const [email, setEmail] = useState('')

  return (
    <>
      <form
        className={classnames('d-sm-flex w-100 justify-content-center', {
          footer,
        })}
        onSubmit={async (e) => {
          e.preventDefault()

          analytics.track(`On Mailing List Subscription`, {
            category: 'general',
          })

          const searchParams = new URLSearchParams()
          searchParams.set('email', email)
          searchParams.set('source', 'ousd')

          const response = await fetch(process.env.EMAIL_LIST_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            credentials: 'same-origin',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            referrerPolicy: 'no-referrer',
            body: searchParams,
          })

          if (response.ok) {
            const json = await response.json()
            if (json.success) {
              setEmail('')
              if (json.message === `You're already registered!`) {
                toast.success(
                  fbt(
                    "You're already registered!",
                    'Email Subscription already registered'
                  )
                )
              } else {
                toast.success(
                  fbt('Thanks for signing up!', 'Email Subscription success')
                )
              }
            } else {
              toast.error(
                fbt(
                  'Error subscribing you to the email list',
                  'ErrorEmailSubscription'
                )
              )
            }
          } else {
            toast.error(
              fbt(
                'Error subscribing you to the email list',
                'ErrorEmailSubscription'
              )
            )
          }
        }}
      >
        <input
          type="email"
          onChange={(e) => {
            e.preventDefault()
            setEmail(e.target.value)
          }}
          required
          value={email}
          placeholder="Your email"
          className="form-control mb-sm-0"
        />
        <button
          type="submit"
          className="btn btn-outline-light d-flex align-items-center justify-content-center subscribe ml-sm-4"
        >
          {footer ? (
            <img
              src={assetRootPath('/images/arrow-icon.svg')}
              alt="Arrow right"
            />
          ) : (
            'Subscribe'
          )}
        </button>
      </form>
      <style jsx>{`
        form {
          padding-top: 60px;
        }

        form.footer {
          padding-top: 30px;
        }

        input[type="email"] {
          width: 281px;
          min-height: 3.125rem;
          border-radius: 5px;
          border: solid 1px #4b5764;
          background-color: #000000;
          color: white;
          font-size: 1.125rem;
        }

        .footer input {
          flex-grow: 1;
        }

        .subscribe {
          border-radius: 25px;
          min-width: 161px;
          min-height: 50px;
        }

        .footer .subscribe {
          min-height: 0;
          min-width: 0;
          width: 52px;
        }

        ::placeholder {
          color: #8293a4;
        }

        div {
          justify-content: center;
        }

        .footer div {
          justify-content: start;
        }

        .footer input {
          background-color: transparent;
          border: none;
          border-bottom: 1px solid #bdcbd5;
          border-radius: 0;
          margin-bottom: 0;
          padding-left 0;
          padding-right: 0;
        }

        button:hover {
          opacity: 1;
        }

        @media (max-width: 992px) {
          form.footer {
            display: flex;
          }
          input[type="email"] {
            margin-bottom: 20px;
            text-align: center;
            width: 100%;
          }

          .footer input {
            text-align: left;
          }

          .subscribe {
            width: 100%;
          }

          .footer .subscribe {
            margin-left: 15px;
          }
        }
      `}</style>
    </>
  )
}

export default EmailForm
