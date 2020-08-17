import Layout from '../components/layout'
import Nav from '../components/nav'

export default function DApp(props) {
  return (
    <Layout dapp>
      <header>
        <Nav dapp />
      </header>
    </Layout>
  )
}
