const path = require('path')
const webpack = require('webpack')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const GitRevisionPlugin = require('git-revision-webpack-plugin')

const gitRevisionPlugin = new GitRevisionPlugin()

let gitCommitHash = process.env.GIT_COMMIT_HASH || process.env.DEPLOY_TAG,
  gitBranch = process.env.GIT_BRANCH

try {
  gitCommitHash = gitRevisionPlugin.commithash()
  gitBranch = gitRevisionPlugin.branch()
} catch (e) {
  /* No Git repo found  */
}

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'

const isStaging = process.env.NAMESPACE === 'staging'
const isDev = process.env.NAMESPACE === 'dev'

let devtool = 'cheap-module-source-map'
if (isTest || process.env.GENERATE_SOURCEMAP === 'false') {
  devtool = false
} else if (isProduction) {
  devtool = 'source-map'
}

const config = {
  entry: {
    app: './src/index.js'
  },
  devtool,
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public')
  },
  externals: {
    sequelize: 'sequelize', // Unused from event-cache
    Web3: 'web3'
  },
  module: {
    noParse: [/^react$/],
    rules: [
      { test: /\.flow$/, loader: 'ignore-loader' },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        query: {
          plugins: [
            [
              'babel-plugin-fbt',
              {
                fbtEnumManifest: require('./translation/fbt/.enum_manifest.json')
              }
            ],
            'babel-plugin-fbt-runtime'
          ]
        }
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: isProduction ? MiniCssExtractPlugin.loader : 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              url: url => {
                return url.match(/(svg|png)/) ? false : true
              }
            }
          }
        ]
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [
          {
            loader: isProduction ? 'file-loader' : 'url-loader',
            options: isProduction ? { name: 'fonts/[name].[ext]' } : {}
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.json'],
    modules: [path.resolve(__dirname, 'src/constants'), './node_modules'],
    symlinks: false
  },
  node: {
    fs: 'empty'
  },
  devServer: {
    port: 8081,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    contentBase: path.join(__dirname, 'public')
  },
  watchOptions: {
    poll: 2000
  },
  mode: isProduction ? 'production' : 'development',
  plugins: [
    new HtmlWebpackPlugin({
      template: 'public/template.html',
      inject: false
    }),
    new webpack.EnvironmentPlugin({
      BUILD_TIMESTAMP: +new Date(),
      GIT_COMMIT_HASH: gitCommitHash,
      GIT_BRANCH: gitBranch,
      HOST: 'localhost',
      LINKER_HOST: 'localhost',
      NAMESPACE: process.env.NAMESPACE || 'dev',
      NODE_ENV: process.env.NODE_ENV || 'development',
      WEBPACK_BUILD: true // Used by EventCache
    })
  ],

  optimization: {
  }
}

if (isProduction) {
  config.output.filename = '[name].[hash:8].js'
  config.optimization.minimizer = [
    new TerserPlugin({ extractComments: false }),
    new OptimizeCSSAssetsPlugin({})
  ]
  config.plugins.push(
    new CleanWebpackPlugin({
      cleanOnceBeforeBuildPatterns: ['app.*.css', 'app.*.js', 'app.*.js.map']
    }),
    new MiniCssExtractPlugin({ filename: '[name].[hash:8].css' }),
    new HtmlWebpackPlugin({
      template: 'public/template.html',
      inject: false,
      filename: 'index.html'
    }),
  )
  config.resolve.alias = {
    'react-styl': 'react-styl/prod.js'
  }
  config.module.noParse = [/^(react-styl)$/]
}

module.exports = config
