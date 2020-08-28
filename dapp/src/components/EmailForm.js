import classnames from 'classnames'
import { fbt } from 'fbt-runtime'

export default function EmailForm({ footer }) {
  return (
    <>
      <form className={classnames('d-sm-flex w-100 justify-content-center', { footer })} onSubmit={e => {
        e.preventDefault()

        alert('To do')}
      }>
        <input
          type="email"
          placeholder="Your email"
          className="form-control mb-sm-0"
        />
        <button
          type="submit"
          className="btn btn-outline-light d-flex align-items-center justify-content-center subscribe ml-sm-4"
        >
          {footer ? <img src="/images/arrow-icon.svg" alt="Arrow right" /> : 'Subscribe'}
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
